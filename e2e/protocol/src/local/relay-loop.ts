import { newCursor, type RelayCursor, type RelayReport } from './relay.ts';

export interface RelayLoopOptions {
  readonly once: (cursor: RelayCursor) => Promise<RelayReport>;
  readonly intervalMs: number;
  readonly signal: AbortSignal;
  readonly log: (line: string) => void;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

// Resolves at the delay or as soon as the signal aborts.
const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });

// Relays on an interval until aborted; a failing pass is logged and the next one still runs.
export async function runRelayLoop({ once, intervalMs, signal, log, sleep = wait }: RelayLoopOptions): Promise<void> {
  const cursor = newCursor();
  while (!signal.aborted) {
    try {
      const report = await once(cursor);
      for (const id of report.delivered) log(`relayed ${id}`);
      for (const { messageId, reason } of report.failed) log(`failed ${messageId}: ${reason}`);
    } catch (error) {
      log(`relay error: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!signal.aborted) await sleep(intervalMs, signal);
  }
}
