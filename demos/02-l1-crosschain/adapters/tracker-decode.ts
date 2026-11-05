import type { Address, Hex, PaymentStatus } from '@hackatwin/core';
import { type Abi, decodeEventLog, parseAbi } from 'viem';

export interface TrackedLog {
  readonly address: Address;
  readonly topics: readonly Hex[];
  readonly data: Hex;
  readonly txHash: Hex;
  readonly blockNumber: bigint;
  readonly logIndex: number;
}

export interface LogReader {
  logs(chainId: number, addresses: readonly Address[]): Promise<readonly TrackedLog[]>;
}

const ROUTER_ABI = parseAbi([
  'event MessageExecuted(bytes32 messageId, uint64 sourceChainSelector, address offRamp, bytes32 calldataHash)',
]);
const BROKER_ABI = parseAbi([
  'event MessageAccepted(bytes32 indexed _messageId, bytes32 indexed _laneId, bytes32 _paymentId)',
  'event DispatchFailed(bytes32 indexed _messageId, bytes32 _paymentId, bytes4 _reason)',
  'event MessageRejected(bytes32 indexed _messageId, bytes4 _reason)',
]);
const HUB_ABI = parseAbi([
  'event StatusChanged(bytes32 indexed _id, bytes32 indexed _paymentId, uint8 _from, uint8 _to)',
]);
const RECEIVER_ABI = parseAbi(['event StatusChanged(bytes32 indexed _paymentId, uint8 _from, uint8 _to)']);
const REMOTE_ABI = parseAbi(['event CallFailed(address indexed recipientContract, uint256 amount)']);

// Enum orders of PaymentHub.Status and SettlementReceiver.Status.
const HUB_STATUS: Readonly<Record<number, PaymentStatus>> = { 1: 'Pending', 3: 'Dispatched' };
const RECEIVER_STATUS: Readonly<Record<number, PaymentStatus>> = { 1: 'Received', 2: 'Settled', 3: 'Rejected' };

// One decoded log: what happened, plus where it was seen.
export type Decoded = { readonly log: TrackedLog } & (
  | { readonly kind: 'sent'; readonly messageId: string }
  | { readonly kind: 'accepted'; readonly messageId: string; readonly paymentId: string }
  | { readonly kind: 'dispatch-failed'; readonly messageId: string; readonly paymentId: string }
  | { readonly kind: 'broker-rejected'; readonly messageId: string; readonly reason: string }
  | { readonly kind: 'hub'; readonly paymentId: string; readonly to: PaymentStatus }
  | { readonly kind: 'receiver'; readonly paymentId: string; readonly to: PaymentStatus }
  | { readonly kind: 'call-failed'; readonly recipient: string }
);

const ordered = (logs: readonly TrackedLog[]): TrackedLog[] =>
  [...logs].sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
  );

const decodeOne = (abi: Abi, log: TrackedLog): { eventName: string; args: Record<string, string> } | undefined => {
  try {
    const { eventName, args } = decodeEventLog({ abi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
    return { eventName: String(eventName), args: (args ?? {}) as unknown as Record<string, string> };
  } catch {
    return undefined;
  }
};

export type Role = 'router' | 'broker' | 'hub' | 'receiver' | 'remote';

const lower = (v: string | undefined): string => (v ?? '').toLowerCase();

const DECODERS: Record<Role, (log: TrackedLog) => Decoded | undefined> = {
  router: (log) => {
    const e = decodeOne(ROUTER_ABI, log);
    return e && { log, kind: 'sent', messageId: lower(e.args.messageId as string) };
  },
  broker: (log) => {
    const e = decodeOne(BROKER_ABI, log);
    if (e === undefined) return undefined;
    const a = e.args;
    const messageId = lower(a._messageId as string);
    if (e.eventName === 'MessageRejected')
      return { log, kind: 'broker-rejected', messageId, reason: a._reason as string };
    const kind = e.eventName === 'MessageAccepted' ? 'accepted' : 'dispatch-failed';
    return { log, kind, messageId, paymentId: lower(a._paymentId as string) };
  },
  hub: (log) => {
    const e = decodeOne(HUB_ABI, log);
    const to = e && HUB_STATUS[Number(e.args._to)];
    return e && to ? { log, kind: 'hub', paymentId: lower(e.args._paymentId), to } : undefined;
  },
  receiver: (log) => {
    const e = decodeOne(RECEIVER_ABI, log);
    const to = e && RECEIVER_STATUS[Number(e.args._to)];
    return e && to ? { log, kind: 'receiver', paymentId: lower(e.args._paymentId), to } : undefined;
  },
  remote: (log) => {
    const e = decodeOne(REMOTE_ABI, log);
    return e && { log, kind: 'call-failed', recipient: lower(e.args.recipientContract) };
  },
};

// Decode: raw logs of one contract into typed facts, ignoring events this tracker does not follow.
export const decodeLogs = (role: Role, logs: readonly TrackedLog[]): Decoded[] =>
  ordered(logs).flatMap((log) => {
    const decoded = DECODERS[role](log);
    return decoded === undefined ? [] : [decoded];
  });
