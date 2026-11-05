import type { GuardedClients } from '@hackatwin/chains';
import type { Hex } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { newCursor, type RelayReport, relayDirection } from '../../src/local/relay.ts';

const ID = `0x${'1'.repeat(64)}` as Hex;
const MESSAGE = `0x${'7'.repeat(64)}` as Hex;
const sent = { args: { messageID: MESSAGE }, transactionHash: `0x${'2'.repeat(64)}`, logIndex: 0 };

// A chain with a head, the Teleporter logs it holds, and whether the destination already has the message.
const side = (head: bigint, rows: unknown[] = [], received = false) => {
  const getLogs = vi.fn(async (_args: unknown) => rows);
  const c = {
    public: { getBlockNumber: vi.fn(async () => head), getLogs, readContract: vi.fn(async () => received) },
  } as unknown as GuardedClients;
  return { c, id: ID, getLogs };
};
const report = (): RelayReport => ({ delivered: [], skipped: [], failed: [] });

describe('relayDirection', () => {
  it('scans from the first block when there is no cursor', async () => {
    const source = side(9n);
    await relayDirection(source, side(0n), report());
    expect(source.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 'earliest' }));
  });

  it('scans from the cursor to the head and moves the cursor past the head', async () => {
    const source = side(9n, [sent]);
    const out = report();
    const cursor = { next: 5n };
    await relayDirection(source, side(0n, [], true), out, cursor);
    expect(source.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 5n, toBlock: 9n }));
    expect(out.skipped).toEqual([MESSAGE]);
    expect(cursor.next).toBe(10n);
  });

  it('keeps the cursor when a delivery fails so the message is retried', async () => {
    const out = report();
    const cursor = { next: 5n };
    await relayDirection(side(9n, [sent]), side(0n), out, cursor);
    expect(out.failed).toHaveLength(1);
    expect(cursor.next).toBe(5n);
  });

  it('reads no logs when no block is new', async () => {
    const source = side(9n, [sent]);
    const cursor = { next: 10n };
    await relayDirection(source, side(0n), report(), cursor);
    expect(source.getLogs).not.toHaveBeenCalled();
    expect(cursor.next).toBe(10n);
  });
});

describe('newCursor', () => {
  it('starts both directions at the first block', () => {
    expect(newCursor()).toEqual({ hub: { next: 0n }, l1: { next: 0n } });
  });
});
