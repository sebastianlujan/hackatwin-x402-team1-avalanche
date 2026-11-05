import { createGuardedClients, type GuardedClients, type LocalChain } from '@hackatwin/chains';
import { type Address, type Hex, parseAbi, parseAbiItem, parseEventLogs, zeroAddress } from 'viem';
import { CANONICAL_TELEPORTER, firstAccount } from './teleporter.ts';
import { stubAbi, WARP } from './world.ts';

export interface RelayReport {
  delivered: Hex[];
  skipped: Hex[];
  failed: { messageId: Hex; reason: string }[];
}

const MESSAGE =
  '(uint256 messageNonce, address originSenderAddress, bytes32 destinationBlockchainID, address destinationAddress, uint256 requiredGasLimit, address[] allowedRelayerAddresses, (uint256 receivedMessageNonce, address relayerRewardAddress)[] receipts, bytes message)';

export const teleporterAbi = parseAbi([
  'function sendCrossChainMessage((bytes32 destinationBlockchainID, address destinationAddress, (address feeTokenAddress, uint256 amount) feeInfo, uint256 requiredGasLimit, address[] allowedRelayerAddresses, bytes message) input) returns (bytes32)',
  'function receiveCrossChainMessage(uint32 messageIndex, address relayerRewardAddress)',
  'function messageReceived(bytes32 messageID) view returns (bool)',
]);
export const sendEvent = parseAbiItem(
  `event SendCrossChainMessage(bytes32 indexed messageID, bytes32 indexed destinationBlockchainID, ${MESSAGE} message, (address feeTokenAddress, uint256 amount) feeInfo)`,
);
export const receiveEvent = parseAbiItem(
  `event ReceiveCrossChainMessage(bytes32 indexed messageID, bytes32 indexed sourceBlockchainID, address indexed deliverer, address rewardRedeemer, ${MESSAGE} message)`,
);

export const messageReceived = (c: GuardedClients, messageID: Hex): Promise<boolean> =>
  c.public.readContract({
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'messageReceived',
    args: [messageID],
  });

// The first account on the source sends a payload to itself on the destination and the message ID comes back.
export async function sendMessage(
  source: GuardedClients,
  destinationBlockchainID: Hex,
  allowedRelayerAddresses: Address[] = [],
): Promise<Hex> {
  const sender = await firstAccount(source);
  const hash = await source.wallet(sender).writeContract({
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'sendCrossChainMessage',
    args: [
      {
        destinationBlockchainID,
        destinationAddress: sender.address,
        feeInfo: { feeTokenAddress: zeroAddress, amount: 0n },
        requiredGasLimit: 100_000n,
        allowedRelayerAddresses,
        message: '0x1234',
      },
    ],
  });
  const receipt = await source.public.waitForTransactionReceipt({ hash });
  const [sent] = parseEventLogs({ abi: [sendEvent], logs: receipt.logs });
  if (!sent) throw new Error('send receipt lacks the Teleporter event');
  return sent.args.messageID;
}

interface Side {
  c: GuardedClients;
  id: Hex;
}

// The stub event that follows the Teleporter event in the same receipt carries the exact Warp bytes.
async function warpBytes(source: Side, txHash: Hex, sendLogIndex: number): Promise<Hex> {
  const receipt = await source.c.public.getTransactionReceipt({ hash: txHash });
  const warp = parseEventLogs({ abi: stubAbi, logs: receipt.logs, eventName: 'WarpMessageSent' }).find(
    (log) => log.logIndex > sendLogIndex,
  );
  if (!warp) throw new Error('send receipt lacks the stub event');
  return warp.args.message;
}

async function deliver(source: Side, destination: Side, txHash: Hex, logIndex: number): Promise<void> {
  const relayer = await firstAccount(destination.c);
  const wallet = destination.c.wallet(relayer);
  const message = await warpBytes(source, txHash, logIndex);
  const inject = await wallet.writeContract({
    address: WARP,
    abi: stubAbi,
    functionName: 'setVerifiedMessage',
    args: [0, source.id, CANONICAL_TELEPORTER, message],
  });
  await destination.c.public.waitForTransactionReceipt({ hash: inject });
  const call = {
    address: CANONICAL_TELEPORTER,
    abi: teleporterAbi,
    functionName: 'receiveCrossChainMessage',
    args: [0, relayer.address],
  } as const;
  // A dry run surfaces the revert reason before any transaction is sent.
  await destination.c.public.simulateContract({ ...call, account: relayer });
  const hash = await wallet.writeContract(call);
  const receipt = await destination.c.public.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`receiveCrossChainMessage reverted in ${hash}`);
}

async function relayDirection(source: Side, destination: Side, report: RelayReport): Promise<void> {
  const logs = await source.c.public.getLogs({
    address: CANONICAL_TELEPORTER,
    event: sendEvent,
    args: { destinationBlockchainID: destination.id },
    fromBlock: 'earliest',
  });
  for (const log of logs) {
    const messageId = log.args.messageID;
    if (!messageId) continue;
    if (await messageReceived(destination.c, messageId)) {
      report.skipped.push(messageId);
      continue;
    }
    try {
      await deliver(source, destination, log.transactionHash, log.logIndex);
      report.delivered.push(messageId);
    } catch (error) {
      const reason = (error as { shortMessage?: string }).shortMessage ?? String(error);
      report.failed.push({ messageId, reason });
    }
  }
}

// One pass over both directions; a message already received on its destination is skipped.
export async function relayOnce(
  chains: { hub: LocalChain; l1: LocalChain },
  ids: { hub: Hex; l1: Hex },
): Promise<RelayReport> {
  const hub = { c: await createGuardedClients({ chain: chains.hub, rpcUrl: chains.hub.rpcUrl }), id: ids.hub };
  const l1 = { c: await createGuardedClients({ chain: chains.l1, rpcUrl: chains.l1.rpcUrl }), id: ids.l1 };
  const report: RelayReport = { delivered: [], skipped: [], failed: [] };
  await relayDirection(hub, l1, report);
  await relayDirection(l1, hub, report);
  return report;
}
