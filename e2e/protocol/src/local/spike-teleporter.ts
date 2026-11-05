import { createGuardedClients, type GuardedClients, type LocalChain } from '@hackatwin/chains';
import { type Address, type Hex, parseAbi, parseAbiItem, parseEventLogs, zeroAddress } from 'viem';
import { CANONICAL_TELEPORTER, firstAccount } from './teleporter.ts';
import { deployInfra, stubAbi, WARP } from './world.ts';

export interface SpikeReport {
  attempts: { method: 'A' | 'B' | 'C'; ok: boolean; detail: string }[];
  winner?: 'A' | 'B' | 'C';
  address?: Address;
  codeSize: { hub: number; l1: number };
  roundTrip: boolean;
}

const teleporterAbi = parseAbi([
  'function sendCrossChainMessage((bytes32 destinationBlockchainID, address destinationAddress, (address feeTokenAddress, uint256 amount) feeInfo, uint256 requiredGasLimit, address[] allowedRelayerAddresses, bytes message) input) returns (bytes32)',
  'function receiveCrossChainMessage(uint32 messageIndex, address relayerRewardAddress)',
  'function messageReceived(bytes32 messageID) view returns (bool)',
]);
const sendEvent = parseAbiItem(
  'event SendCrossChainMessage(bytes32 indexed messageID, bytes32 indexed destinationBlockchainID, (uint256 messageNonce, address originSenderAddress, bytes32 destinationBlockchainID, address destinationAddress, uint256 requiredGasLimit, address[] allowedRelayerAddresses, (uint256 receivedMessageNonce, address relayerRewardAddress)[] receipts, bytes message) message, (address feeTokenAddress, uint256 amount) feeInfo)',
);

const codeSize = async (c: GuardedClients): Promise<number> =>
  ((await c.public.getCode({ address: CANONICAL_TELEPORTER })) ?? '0x').length / 2 - 1;

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
  const report: SpikeReport = { attempts: [], codeSize: { hub: 0, l1: 0 }, roundTrip: false };
  let ids: { hub: Hex; l1: Hex };
  try {
    ({ ids } = await deployInfra(hub, l1));
    report.attempts.push({ method: 'A', ok: true, detail: 'impersonated v1 deployer at nonce 0' });
    report.winner = 'A';
    report.address = CANONICAL_TELEPORTER;
  } catch (error) {
    report.attempts.push({ method: 'A', ok: false, detail: String(error) });
    return report;
  }
  const h = await createGuardedClients({ chain: hub, rpcUrl: hub.rpcUrl });
  const l = await createGuardedClients({ chain: l1, rpcUrl: l1.rpcUrl });
  report.codeSize = { hub: await codeSize(h), l1: await codeSize(l) };
  report.roundTrip = await roundTrip(h, l, ids);
  return report;
}
