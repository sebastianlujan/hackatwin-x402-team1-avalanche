import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGuardedClients, type GuardedClients, type LocalChain } from '@hackatwin/chains';
import {
  type Account,
  type Address,
  type Hex,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseAbiItem,
  parseEventLogs,
  toHex,
  zeroAddress,
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

type Rpc = { request(args: { method: 'eth_accounts' }): Promise<Address[]> };
const unlocked = (address: Address): Account => ({ address, type: 'json-rpc' }) as Account;
const firstAccount = async (c: GuardedClients): Promise<Account> => {
  const [address] = await (c.public as unknown as Rpc).request({ method: 'eth_accounts' });
  if (!address) throw new Error('anvil exposes no unlocked accounts');
  return unlocked(address);
};
const codeSize = async (c: GuardedClients): Promise<number> =>
  ((await c.public.getCode({ address: CANONICAL_TELEPORTER })) ?? '0x').length / 2 - 1;

// Method A: the v1 deployer is impersonated at nonce 0 and deploys the pinned build, so CREATE yields the canonical address.
async function placeA(c: GuardedClients, initcode: Hex): Promise<Address> {
  const cheats = c.cheats();
  await cheats.setBalance(V1_DEPLOYER, 10n ** 18n);
  await cheats.impersonate(V1_DEPLOYER);
  const hash = await c.wallet(unlocked(V1_DEPLOYER)).sendTransaction({ data: initcode, gas: 6_000_000n });
  await cheats.stopImpersonating(V1_DEPLOYER);
  const receipt = await c.public.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress || !isAddressEqual(receipt.contractAddress, CANONICAL_TELEPORTER))
    throw new Error(`deployed at ${receipt.contractAddress}`);
  return CANONICAL_TELEPORTER;
}

// Hub sends, the relay injects the exact stub bytes on the L1, and the L1 Teleporter marks the message received.
async function roundTrip(h: GuardedClients, l: GuardedClients, ids: { hub: Hex; l1: Hex }): Promise<boolean> {
  const [sender, relayer] = [await firstAccount(h), await firstAccount(l)];
  const input = {
    destinationBlockchainID: ids.l1,
    destinationAddress: relayer.address,
    feeInfo: { feeTokenAddress: zeroAddress, amount: 0n },
    requiredGasLimit: 100_000n,
    allowedRelayerAddresses: [],
    message: '0x1234',
  } as const;
  const send = await h.wallet(sender).writeContract({
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'sendCrossChainMessage',
    args: [input],
  });
  const receipt = await h.public.waitForTransactionReceipt({ hash: send });
  const [sent] = parseEventLogs({ abi: [sendEvent], logs: receipt.logs });
  const [warp] = parseEventLogs({ abi: stubAbi, logs: receipt.logs, eventName: 'WarpMessageSent' });
  if (!sent || !warp) throw new Error('send receipt lacks the Teleporter or stub event');
  const wallet = l.wallet(relayer);
  const inject = await wallet.writeContract({
    address: WARP,
    abi: stubAbi,
    functionName: 'setVerifiedMessage',
    args: [0, ids.hub, CANONICAL_TELEPORTER, warp.args.message],
  });
  await l.public.waitForTransactionReceipt({ hash: inject });
  const deliver = await wallet.writeContract({
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'receiveCrossChainMessage',
    args: [0, relayer.address],
  });
  await l.public.waitForTransactionReceipt({ hash: deliver });
  return l.public.readContract({
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
  const h = await createGuardedClients({ chain: hub, rpcUrl: hub.rpcUrl });
  const l = await createGuardedClients({ chain: l1, rpcUrl: l1.rpcUrl });
  const report: SpikeReport = { attempts: [], codeSize: { hub: 0, l1: 0 }, roundTrip: false };
  for (const [c, id] of [
    [h, ids.hub],
    [l, ids.l1],
  ] as const) {
    await c.cheats().setCode(WARP, stub);
    await c
      .wallet(await firstAccount(c))
      .writeContract({ address: WARP, abi: stubAbi, functionName: 'setBlockchainID', args: [id] });
  }
  try {
    await placeA(h, initcode);
    await placeA(l, initcode);
    report.attempts.push({ method: 'A', ok: true, detail: 'impersonated v1 deployer at nonce 0' });
    report.winner = 'A';
    report.address = CANONICAL_TELEPORTER;
  } catch (error) {
    report.attempts.push({ method: 'A', ok: false, detail: String(error) });
    return report;
  }
  report.codeSize = { hub: await codeSize(h), l1: await codeSize(l) };
  report.roundTrip = await roundTrip(h, l, ids);
  return report;
}
