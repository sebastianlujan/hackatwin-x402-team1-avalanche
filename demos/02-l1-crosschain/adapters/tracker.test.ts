import { readFileSync } from 'node:fs';
import type { Address } from '@hackatwin/core';
import { describe, expect, it, vi } from 'vitest';
import {
  BROKER,
  type FixtureLog,
  HUB,
  logs,
  MESSAGE_ID,
  REASON,
  RECEIVER,
  REMOTE,
  ROUTER,
  txHash,
} from './tracker.fixtures.ts';
import { type HopProgress, HopTracker, MessageNotFoundError } from './tracker.ts';
import type { LogReader } from './tracker-decode.ts';

const HUB_CHAIN = { key: 'local-hub', chainId: 31337, local: true };
const L1_CHAIN = { key: 'local-l1', chainId: 31338, local: true };
const FUJI = { key: 'fuji', chainId: 43113, local: false };
const NOW = 1_700_000_000;

class FakeLogReader implements LogReader {
  readonly reads: number[] = [];
  private readonly byChain: Readonly<Record<number, readonly FixtureLog[]>>;
  constructor(byChain: Readonly<Record<number, readonly FixtureLog[]>>) {
    this.byChain = byChain;
  }
  async logs(chainId: number, addresses: readonly Address[]) {
    this.reads.push(chainId);
    const wanted = new Set(addresses.map((a) => a.toLowerCase()));
    return (this.byChain[chainId] ?? []).filter((l) => wanted.has(l.address.toLowerCase()));
  }
}

class MemoryProgress implements HopProgress {
  readonly map = new Map<string, number>();
  last(messageId: string) {
    return this.map.get(messageId) ?? -1;
  }
  record(messageId: string, index: number) {
    this.map.set(messageId, index);
  }
}

const tracker = (
  hubLogs: readonly FixtureLog[],
  l1Logs: readonly FixtureLog[],
  extra: { progress?: HopProgress; hub?: typeof HUB_CHAIN | typeof FUJI } = {},
) =>
  new HopTracker({
    reader: new FakeLogReader({ 31337: hubLogs, 43113: hubLogs, 31338: l1Logs }),
    source: { chain: extra.hub ?? HUB_CHAIN, router: ROUTER },
    hub: { chain: extra.hub ?? HUB_CHAIN, broker: BROKER, hub: HUB },
    l1: { chain: L1_CHAIN, receiver: RECEIVER, remote: REMOTE },
    ...(extra.progress === undefined ? {} : { progress: extra.progress }),
    explorerUrl: (key, hash) => (key === 'fuji' ? `https://testnet.snowtrace.io/tx/${hash}` : undefined),
    now: () => NOW,
  });

const collect = async <T>(source: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
};
const summary = (hops: readonly { index: number; status: string }[]) => hops.map((h) => `${h.index}:${h.status}`);

const settled = () => ({
  hub: [logs.executed(1, 1), logs.accepted(2, 2), logs.hub(1), logs.hub(3)],
  l1: [logs.receiver(1, 3, 3), logs.receiver(2, 3, 3)],
});

describe('HopTracker', () => {
  it('Happy path: emits send, Pending, Dispatched, Received, Settled at indices 0 to 4, each once', async () => {
    const { hub, l1 } = settled();
    const hops = await collect(tracker(hub, l1).track(MESSAGE_ID));
    expect(summary(hops)).toEqual(['0:None', '1:Pending', '2:Dispatched', '3:Received', '4:Settled']);
    expect(hops.map((h) => h.transport)).toEqual(['local', 'local', 'ictt', 'icm', 'icm']);
    expect(hops.map((h) => h.chainId)).toEqual([31337, 31337, 31337, 31338, 31338]);
    expect(hops.map((h) => h.txHash)).toEqual([1, 2, 2, 3, 3].map(txHash));
  });

  it('Rejected: the hop at index 4 is Rejected and no Settled hop exists', async () => {
    const hub = [logs.executed(), logs.accepted(), logs.hub(1), logs.hub(3)];
    const hops = await collect(tracker(hub, [logs.receiver(1, 3, 3), logs.receiver(3, 3, 3)]).track(MESSAGE_ID));
    expect(summary(hops).slice(3)).toEqual(['3:Received', '4:Rejected']);
    expect(hops.some((h) => h.status === 'Settled')).toBe(false);
  });

  it('ICTT failure: one Rejected hop at index 4 and no separate failure hop', async () => {
    const hub = [logs.executed(), logs.accepted(), logs.hub(1), logs.hub(3)];
    const hops = await collect(tracker(hub, [logs.callFailed(3, 3)]).track(MESSAGE_ID));
    expect(summary(hops)).toEqual(['0:None', '1:Pending', '2:Dispatched', '4:Rejected']);
    expect(hops[3]?.transport).toBe('ictt');
  });

  it('ICTT failure after Received: still one Rejected hop at index 4', async () => {
    const hub = [logs.executed(), logs.accepted(), logs.hub(1), logs.hub(3)];
    const l1 = [logs.receiver(1, 3, 3), logs.callFailed(3, 3)];
    expect(summary(await collect(tracker(hub, l1).track(MESSAGE_ID))).slice(3)).toEqual(['3:Received', '4:Rejected']);
  });

  it('Broker rejection: send then Rejected with the event reason and no hops 1 to 3', async () => {
    const hub = [logs.executed(), logs.brokerRejected()];
    const hops = await collect(tracker(hub, []).track(MESSAGE_ID));
    expect(summary(hops)).toEqual(['0:None', '4:Rejected']);
    expect(hops[1]).toMatchObject({ transport: 'local', reason: REASON });
  });

  it('Duplicate log: the same StatusChanged delivered twice emits one hop', async () => {
    const pending = logs.hub(1);
    const hub = [logs.executed(), logs.accepted(), pending, pending, logs.hub(3)];
    const hops = await collect(tracker(hub, []).track(MESSAGE_ID));
    expect(summary(hops)).toEqual(['0:None', '1:Pending', '2:Dispatched']);
  });

  it('Repeated poll: a second pass over the same logs emits nothing', async () => {
    const { hub, l1 } = settled();
    const polled = tracker(hub, l1, { progress: new MemoryProgress() });
    expect(await collect(polled.track(MESSAGE_ID))).toHaveLength(5);
    expect(await collect(polled.track(MESSAGE_ID))).toEqual([]);
  });

  it('Local: no hop has explorerUrl and each event carries the simulated marker', async () => {
    const { hub, l1 } = settled();
    const events = await collect(tracker(hub, l1).events(MESSAGE_ID));
    expect(events).toHaveLength(5);
    for (const event of events) {
      expect(event).toMatchObject({
        version: 1,
        type: 'hop',
        at: NOW,
        messageId: MESSAGE_ID,
        simulated: 'local-crosschain',
      });
      expect(event.hop.explorerUrl).toBeUndefined();
      expect('explorerUrl' in event.hop).toBe(false);
    }
  });

  it('Fuji: a hop on a read-write chain carries the explorer URL and no simulated marker', async () => {
    const hub = [logs.executed(), logs.brokerRejected()];
    const events = await collect(tracker(hub, [], { hub: FUJI }).events(MESSAGE_ID));
    expect(events[0]?.hop.explorerUrl).toBe(`https://testnet.snowtrace.io/tx/${txHash(1)}`);
    expect(events[0]?.simulated).toBeUndefined();
  });

  it('Resume: only the hops after the recorded progress are emitted', async () => {
    const { hub, l1 } = settled();
    const progress = new MemoryProgress();
    progress.record(MESSAGE_ID, 2);
    const hops = await collect(tracker(hub, l1, { progress }).track(MESSAGE_ID));
    expect(summary(hops)).toEqual(['3:Received', '4:Settled']);
    expect(progress.last(MESSAGE_ID)).toBe(4);
  });

  it('Unknown ID: emits nothing and reports not found', async () => {
    const unknown = tracker([logs.executed(1, 1, `0x${'1'.repeat(64)}`)], []);
    const seen: unknown[] = [];
    const run = (async () => {
      for await (const hop of unknown.track(MESSAGE_ID)) seen.push(hop);
    })();
    await expect(run).rejects.toBeInstanceOf(MessageNotFoundError);
    await expect(run).rejects.toThrow(MESSAGE_ID);
    expect(seen).toEqual([]);
  });

  it('Fixture replay: the recorded logs map to the expected hop list with no network', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const recorded = JSON.parse(readFileSync(new URL('./fixtures/local-happy.json', import.meta.url), 'utf8')) as {
      logs: Record<string, (Omit<FixtureLog, 'blockNumber'> & { blockNumber: string })[]>;
      expected: unknown[];
    };
    const revive = (list: (typeof recorded.logs)[string]) =>
      list.map((l) => ({ ...l, blockNumber: BigInt(l.blockNumber) }));
    const hops = await collect(
      tracker(revive(recorded.logs['31337'] ?? []), revive(recorded.logs['31338'] ?? [])).track(MESSAGE_ID),
    );
    expect(hops).toEqual(recorded.expected);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('holds no function selector literal in the source', () => {
    expect(readFileSync(new URL('./tracker.ts', import.meta.url), 'utf8')).not.toMatch(/0x[0-9a-fA-F]{8}\b/);
  });
});
