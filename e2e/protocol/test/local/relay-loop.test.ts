import { describe, expect, it, vi } from 'vitest';
import type { RelayCursor, RelayReport } from '../../src/local/relay.ts';
import { runRelayLoop } from '../../src/local/relay-loop.ts';

const quiet: RelayReport = { delivered: [], skipped: [], failed: [] };

// Runs the loop until `once` has been called `ticks` times, then aborts it.
async function run(ticks: number, results: (tick: number) => Promise<RelayReport>) {
  const abort = new AbortController();
  const cursors: RelayCursor[] = [];
  const sleeps: number[] = [];
  const lines: string[] = [];
  let tick = 0;
  await runRelayLoop({
    once: async (cursor) => {
      cursors.push(cursor);
      tick += 1;
      if (tick >= ticks) abort.abort();
      return results(tick);
    },
    intervalMs: 250,
    signal: abort.signal,
    log: (line) => lines.push(line),
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { cursors, sleeps, lines };
}

describe('runRelayLoop', () => {
  it('relays every interval with one cursor until aborted', async () => {
    const { cursors, sleeps, lines } = await run(3, async () => quiet);
    expect(cursors).toHaveLength(3);
    expect(new Set(cursors).size).toBe(1);
    expect(sleeps).toEqual([250, 250]);
    expect(lines).toEqual([]);
  });

  it('logs each delivery and failure', async () => {
    const { lines } = await run(1, async () => ({
      delivered: ['0xaa'],
      skipped: ['0xbb'],
      failed: [{ messageId: '0xcc', reason: 'reverted' }],
    }));
    expect(lines).toEqual(['relayed 0xaa', 'failed 0xcc: reverted']);
  });

  it('logs a failing tick and keeps relaying', async () => {
    const { cursors, lines } = await run(3, async (tick) => {
      if (tick === 2) throw new Error('rpc down');
      return quiet;
    });
    expect(cursors).toHaveLength(3);
    expect(lines).toEqual(['relay error: rpc down']);
  });

  it('stops within an interval of the abort, without waiting it out', async () => {
    const abort = new AbortController();
    const once = vi.fn(async () => {
      abort.abort();
      return quiet;
    });
    const started = Date.now();
    await runRelayLoop({ once, intervalMs: 60_000, signal: abort.signal, log: () => undefined });
    expect(once).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
