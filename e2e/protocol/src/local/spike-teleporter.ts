import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type LocalChain, toViemLocalChain } from '@hackatwin/chains';
import {
  type Address,
  createPublicClient,
  createTestClient,
  createWalletClient,
  type Hex,
  http,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseAbiItem,
  parseEventLogs,
  toHex,
} from 'viem';
import { ICM_COMMIT, icmCacheDir } from './icm-fetch.ts';

export const CANONICAL_TELEPORTER: Address = '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf';
const V1_DEPLOYER: Address = '0x618FEdD9A45a8C456812ecAAE70C671c6249DfaC';
const WARP: Address = '0x0200000000000000000000000000000000000005';
const root = join(import.meta.dirname, '../../../..');

export interface SpikeReport {
  attempts: { method: 'A' | 'B' | 'C'; ok: boolean; detail: string }[];
  winner?: 'A' | 'B' | 'C';
  address?: Address;
  codeSize: { hub: number; l1: number };
  roundTrip: boolean;
}

const stubAbi = parseAbi([
  'function setBlockchainID(bytes32 id)',
  'function setVerifiedMessage(uint32 index, bytes32 sourceChainID, address originSender, bytes payload)',
  'event WarpMessageSent(bytes32 indexed messageID, bytes message)',
]);
const teleporterAbi = parseAbi([
  'function sendCrossChainMessage((bytes32 destinationBlockchainID, address destinationAddress, (address feeTokenAddress, uint256 amount) feeInfo, uint256 requiredGasLimit, address[] allowedRelayerAddresses, bytes message) input) returns (bytes32)',
  'function receiveCrossChainMessage(uint32 messageIndex, address relayerRewardAddress)',
  'function messageReceived(bytes32 messageID) view returns (bool)',
]);
const sendEvent = parseAbiItem(
  'event SendCrossChainMessage(bytes32 indexed messageID, bytes32 indexed destinationBlockchainID, (uint256 messageNonce, address originSenderAddress, bytes32 destinationBlockchainID, address destinationAddress, uint256 requiredGasLimit, address[] allowedRelayerAddresses, (uint256 receivedMessageNonce, address relayerRewardAddress)[] receipts, bytes message) message, (address feeTokenAddress, uint256 amount) feeInfo)',
);

const artifact = (path: string): { bytecode: Hex; deployedBytecode: Hex } => {
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    bytecode: { object: Hex };
    deployedBytecode: { object: Hex };
  };
  return { bytecode: json.bytecode.object, deployedBytecode: json.deployedBytecode.object };
};

function clientsFor(chain: LocalChain) {
  const transport = http(chain.rpcUrl);
  const viemChain = toViemLocalChain(chain);
  return {
    pub: createPublicClient({ chain: viemChain, transport }),
    test: createTestClient({ chain: viemChain, mode: 'anvil', transport }),
    wallet: createWalletClient({ chain: viemChain, transport }),
  };
}

// Method A: the v1 deployer is impersonated at nonce 0 and deploys the pinned build, so CREATE yields the canonical address.
async function placeA(chain: LocalChain, initcode: Hex): Promise<Address> {
  const { pub, test, wallet } = clientsFor(chain);
  await test.setBalance({ address: V1_DEPLOYER, value: 10n ** 18n });
  await test.impersonateAccount({ address: V1_DEPLOYER });
  const hash = await wallet.sendTransaction({ account: V1_DEPLOYER, data: initcode, gas: 6_000_000n });
  await test.stopImpersonatingAccount({ address: V1_DEPLOYER });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress || !isAddressEqual(receipt.contractAddress, CANONICAL_TELEPORTER))
    throw new Error(`deployed at ${receipt.contractAddress}`);
  return CANONICAL_TELEPORTER;
}

// Hub sends, the relay injects the exact stub bytes on the L1, and the L1 Teleporter marks the message received.
async function roundTrip(hub: LocalChain, l1: LocalChain, ids: { hub: Hex; l1: Hex }): Promise<boolean> {
  const h = clientsFor(hub);
  const l = clientsFor(l1);
  const [sender] = await h.wallet.getAddresses();
  const [relayer] = await l.wallet.getAddresses();
  if (!sender || !relayer) throw new Error('anvil exposes no unlocked accounts');
  const input = {
    destinationBlockchainID: ids.l1,
    destinationAddress: relayer,
    feeInfo: { feeTokenAddress: '0x0000000000000000000000000000000000000000', amount: 0n },
    requiredGasLimit: 100_000n,
    allowedRelayerAddresses: [],
    message: '0x1234',
  } as const;
  const hash = await h.wallet.writeContract({
    account: sender,
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'sendCrossChainMessage',
    args: [input],
  });
  const receipt = await h.pub.waitForTransactionReceipt({ hash });
  const [sent] = parseEventLogs({ abi: [sendEvent], logs: receipt.logs });
  const [warp] = parseEventLogs({ abi: stubAbi, logs: receipt.logs, eventName: 'WarpMessageSent' });
  if (!sent || !warp) throw new Error('send receipt lacks the Teleporter or stub event');
  const inject = await l.wallet.writeContract({
    account: relayer,
    address: WARP,
    abi: stubAbi,
    functionName: 'setVerifiedMessage',
    args: [0, ids.hub, CANONICAL_TELEPORTER, warp.args.message],
  });
  await l.pub.waitForTransactionReceipt({ hash: inject });
  const deliver = await l.wallet.writeContract({
    account: relayer,
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'receiveCrossChainMessage',
    args: [0, relayer],
  });
  await l.pub.waitForTransactionReceipt({ hash: deliver });
  return l.pub.readContract({
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'messageReceived',
    args: [sent.args.messageID],
  });
}

export async function runSpike(hub: LocalChain, l1: LocalChain): Promise<SpikeReport> {
  const stub = artifact(
    join(root, 'packages/contracts/out/WarpMessengerStub.sol/WarpMessengerStub.json'),
  ).deployedBytecode;
  const initcode = artifact(
    join(icmCacheDir(root, ICM_COMMIT), 'out/TeleporterMessenger.sol/TeleporterMessenger.json'),
  ).bytecode;
  const ids = { hub: keccak256(toHex('local-hub')), l1: keccak256(toHex('local-l1')) };
  const report: SpikeReport = { attempts: [], codeSize: { hub: 0, l1: 0 }, roundTrip: false };
  for (const [chain, id] of [
    [hub, ids.hub],
    [l1, ids.l1],
  ] as const) {
    const { wallet, test } = clientsFor(chain);
    await test.setCode({ address: WARP, bytecode: stub });
    const [account] = await wallet.getAddresses();
    if (!account) throw new Error('anvil exposes no unlocked accounts');
    await wallet.writeContract({ account, address: WARP, abi: stubAbi, functionName: 'setBlockchainID', args: [id] });
  }
  try {
    await placeA(hub, initcode);
    await placeA(l1, initcode);
    report.attempts.push({ method: 'A', ok: true, detail: 'impersonated v1 deployer at nonce 0' });
    report.winner = 'A';
    report.address = CANONICAL_TELEPORTER;
  } catch (error) {
    report.attempts.push({ method: 'A', ok: false, detail: String(error) });
    return report;
  }
  report.codeSize = {
    hub: ((await clientsFor(hub).pub.getCode({ address: CANONICAL_TELEPORTER })) ?? '0x').length / 2 - 1,
    l1: ((await clientsFor(l1).pub.getCode({ address: CANONICAL_TELEPORTER })) ?? '0x').length / 2 - 1,
  };
  report.roundTrip = await roundTrip(hub, l1, ids);
  return report;
}
