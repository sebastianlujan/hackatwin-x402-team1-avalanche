import type { Address, Hex } from '@hackatwin/core';
import { type Abi, encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';

export interface FixtureLog {
  readonly address: Address;
  readonly topics: readonly Hex[];
  readonly data: Hex;
  readonly txHash: Hex;
  readonly blockNumber: bigint;
  readonly logIndex: number;
}

export const ROUTER = `0x${'a1'.repeat(20)}` as Address;
export const BROKER = `0x${'b2'.repeat(20)}` as Address;
export const HUB = `0x${'c3'.repeat(20)}` as Address;
export const RECEIVER = `0x${'d4'.repeat(20)}` as Address;
export const REMOTE = `0x${'e5'.repeat(20)}` as Address;
export const MESSAGE_ID = `0x${'7'.repeat(64)}` as Hex;
export const PAYMENT_ID = `0x${'9'.repeat(64)}` as Hex;
export const LANE_ID = `0x${'5'.repeat(64)}` as Hex;
export const REASON = '0xdeadbeef' as Hex;
export const txHash = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;

const ABI = parseAbi([
  'event MessageExecuted(bytes32 messageId, uint64 sourceChainSelector, address offRamp, bytes32 calldataHash)',
  'event MessageAccepted(bytes32 indexed _messageId, bytes32 indexed _laneId, bytes32 _paymentId)',
  'event MessageRejected(bytes32 indexed _messageId, bytes4 _reason)',
  'event StatusChanged(bytes32 indexed _id, bytes32 indexed _paymentId, uint8 _from, uint8 _to)',
  'event CallFailed(address indexed recipientContract, uint256 amount)',
]);
const RECEIVER_ABI = parseAbi(['event StatusChanged(bytes32 indexed _paymentId, uint8 _from, uint8 _to)']);

// Encodes the way the node does: indexed arguments become topics, the rest become data.
const encode = (abi: Abi, name: string, args: Record<string, unknown>) => {
  const item = abi.find((i) => i.type === 'event' && i.name === name);
  if (item?.type !== 'event') throw new Error(`no event ${name}`);
  const indexed = Object.fromEntries(item.inputs.filter((i) => i.indexed).map((i) => [i.name, args[i.name as string]]));
  const plain = item.inputs.filter((i) => !i.indexed);
  return {
    topics: encodeEventTopics({ abi, eventName: name, args: indexed }) as Hex[],
    data: encodeAbiParameters(
      plain,
      plain.map((i) => args[i.name as string]),
    ),
  };
};

let counter = 0;
const place = (address: Address, tx: number, block: number, body: { topics: Hex[]; data: Hex }): FixtureLog => ({
  address,
  ...body,
  txHash: txHash(tx),
  blockNumber: BigInt(block),
  logIndex: counter++,
});

// Hub statuses: 1 Pending, 3 Dispatched. Receiver statuses: 1 Received, 2 Settled, 3 Rejected.
export const logs = {
  executed: (tx = 1, block = 1, id = MESSAGE_ID) =>
    place(
      ROUTER,
      tx,
      block,
      encode(ABI, 'MessageExecuted', {
        messageId: id,
        sourceChainSelector: 1n,
        offRamp: BROKER,
        calldataHash: LANE_ID,
      }),
    ),
  accepted: (tx = 2, block = 2) =>
    place(
      BROKER,
      tx,
      block,
      encode(ABI, 'MessageAccepted', { _messageId: MESSAGE_ID, _laneId: LANE_ID, _paymentId: PAYMENT_ID }),
    ),
  brokerRejected: (tx = 2, block = 2) =>
    place(BROKER, tx, block, encode(ABI, 'MessageRejected', { _messageId: MESSAGE_ID, _reason: REASON })),
  hub: (to: number, tx = 2, block = 2) =>
    place(
      HUB,
      tx,
      block,
      encode(ABI, 'StatusChanged', { _id: LANE_ID, _paymentId: PAYMENT_ID, _from: to === 1 ? 0 : 1, _to: to }),
    ),
  receiver: (to: number, tx: number, block: number) =>
    place(
      RECEIVER,
      tx,
      block,
      encode(RECEIVER_ABI, 'StatusChanged', { _paymentId: PAYMENT_ID, _from: to === 1 ? 0 : 1, _to: to }),
    ),
  callFailed: (tx: number, block: number) =>
    place(REMOTE, tx, block, encode(ABI, 'CallFailed', { recipientContract: RECEIVER, amount: 5n })),
};
