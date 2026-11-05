import 'server-only';
import type { AgentEvent } from '@hackatwin/core';
import type { Envelope } from '../lib/envelope.ts';
import { redact } from './redact.ts';

export interface BalanceSnapshot {
  readonly agent: bigint;
  readonly seller: bigint;
}

export interface StartedRun {
  readonly llm: 'claude' | 'scripted';
  readonly before: BalanceSnapshot;
  readonly events: AsyncIterable<AgentEvent>;
  after(): Promise<BalanceSnapshot>;
}

export interface RunView {
  readonly id: string;
  readonly status: 'starting' | 'running' | 'finished';
  readonly llm?: 'claude' | 'scripted';
  readonly before?: BalanceSnapshot;
  readonly after?: BalanceSnapshot;
}

export interface RunStore {
  start(open: () => Promise<StartedRun>): Promise<{ readonly id: string } | { readonly conflict: string }>;
  latest(): RunView | undefined;
  get(id: string): RunView | undefined;
  subscribe(id: string, afterSeq: number, onFrame: (e: Envelope) => void): (() => void) | undefined;
}

export interface RunStoreOptions {
  readonly newId?: () => string;
  readonly now?: () => number;
}

interface RunRecord {
  readonly id: string;
  status: RunView['status'];
  llm?: 'claude' | 'scripted';
  before?: BalanceSnapshot;
  after?: BalanceSnapshot | undefined;
  readonly frames: Envelope[];
  readonly listeners: Set<(e: Envelope) => void>;
}

const view = (r: RunRecord): RunView => ({
  id: r.id,
  status: r.status,
  ...(r.llm === undefined ? {} : { llm: r.llm }),
  ...(r.before === undefined ? {} : { before: r.before }),
  ...(r.after === undefined ? {} : { after: r.after }),
});

export function createRunStore({ newId = () => crypto.randomUUID(), now = Date.now }: RunStoreOptions = {}): RunStore {
  let current: RunRecord | undefined;

  const publish = (r: RunRecord, event: AgentEvent): void => {
    const safe =
      event.type === 'run.finished' && event.message !== undefined
        ? { ...event, message: redact(event.message) }
        : event;
    const frame: Envelope = { seq: r.frames.length + 1, source: 'live', event: safe };
    r.frames.push(frame);
    for (const listener of [...r.listeners]) listener(frame);
  };

  const pump = async (r: RunRecord, run: StartedRun): Promise<void> => {
    let finished: AgentEvent | undefined;
    try {
      for await (const event of run.events) {
        if (event.type === 'run.finished') {
          finished = event;
          break;
        }
        publish(r, event);
      }
      finished ??= {
        version: 1,
        type: 'run.finished',
        at: now(),
        reason: 'error',
        message: 'The run ended without run.finished',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finished = { version: 1, type: 'run.finished', at: now(), reason: 'error', message };
    }
    r.after = await run.after().catch(() => undefined);
    r.status = 'finished';
    publish(r, finished);
  };

  return {
    async start(open) {
      if (current !== undefined && current.status !== 'finished') return { conflict: current.id };
      const record: RunRecord = { id: newId(), status: 'starting', frames: [], listeners: new Set() };
      current = record;
      let run: StartedRun;
      try {
        run = await open();
      } catch (error) {
        if (current === record) current = undefined;
        throw error;
      }
      record.status = 'running';
      record.llm = run.llm;
      record.before = run.before;
      void pump(record, run);
      return { id: record.id };
    },
    latest: () => (current === undefined ? undefined : view(current)),
    get: (id) => (current?.id === id ? view(current) : undefined),
    subscribe(id, afterSeq, onFrame) {
      const record = current;
      if (record === undefined || record.id !== id) return undefined;
      for (const frame of record.frames) if (frame.seq > afterSeq) onFrame(frame);
      record.listeners.add(onFrame);
      return () => {
        record.listeners.delete(onFrame);
      };
    },
  };
}

const KEY = Symbol.for('hackatwin.web.runs');

// One store per process, so dev module reloads keep the active run and its buffer.
export function getRunStore(): RunStore {
  const holder = globalThis as { [KEY]?: RunStore };
  holder[KEY] ??= createRunStore();
  return holder[KEY];
}
