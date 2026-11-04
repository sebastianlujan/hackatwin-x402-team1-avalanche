import type { AgentEvent } from '@hackatwin/core';
import { describe, expect, it, vi } from 'vitest';
import { feedback, paymentRequired, received, runFinished, runStarted } from '../../test/events.ts';
import type { Envelope } from '../lib/envelope.ts';
import { createRunStore, getRunStore, type StartedRun } from './run-store.ts';

const balances = { agent: 10n, seller: 0n };
const settled = { agent: 7n, seller: 3n };

// A run whose events the test pushes one at a time.
function controlled(): { run: StartedRun; push: (e: AgentEvent) => void; end: () => void; fail: (e: Error) => void } {
  const queue: Array<{ value?: AgentEvent; error?: Error; done?: boolean }> = [];
  let wake: (() => void) | undefined;
  const put = (item: (typeof queue)[number]): void => {
    queue.push(item);
    wake?.();
  };
  const events: AsyncIterable<AgentEvent> = {
    async *[Symbol.asyncIterator]() {
      for (;;) {
        while (queue.length === 0) await new Promise<void>((resolve) => (wake = resolve));
        const item = queue.shift() as (typeof queue)[number];
        if (item.error) throw item.error;
        if (item.done) return;
        yield item.value as AgentEvent;
      }
    },
  };
  const run: StartedRun = { llm: 'scripted', before: balances, events, after: async () => settled };
  return { run, push: (value) => put({ value }), end: () => put({ done: true }), fail: (error) => put({ error }) };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const collect = (store: ReturnType<typeof createRunStore>, id: string, after = 0): Envelope[] => {
  const frames: Envelope[] = [];
  store.subscribe(id, after, (f) => frames.push(f));
  return frames;
};

describe('run store', () => {
  it('answers 409 with the active id while a run is active', async () => {
    const store = createRunStore();
    const a = controlled();
    const first = await store.start(async () => a.run);
    expect(first).toHaveProperty('id');
    const second = await store.start(async () => controlled().run);
    expect(second).toEqual({ conflict: (first as { id: string }).id });
  });

  it('reserves the slot synchronously, before preflight resolves', async () => {
    const store = createRunStore();
    let release: (r: StartedRun) => void = () => {};
    const open = vi.fn(() => new Promise<StartedRun>((resolve) => (release = resolve)));
    const first = store.start(open);
    const second = await store.start(open);
    expect(second).toHaveProperty('conflict');
    expect(open).toHaveBeenCalledTimes(1);
    release(controlled().run);
    expect(await first).toHaveProperty('id');
  });

  it('frees the slot and creates no run when open throws', async () => {
    const store = createRunStore();
    await expect(store.start(async () => Promise.reject(new Error('seller down')))).rejects.toThrow('seller down');
    expect(store.latest()).toBeUndefined();
    expect(await store.start(async () => controlled().run)).toHaveProperty('id');
  });

  it('numbers frames without gaps, live, and records balances before the final frame', async () => {
    const store = createRunStore();
    const c = controlled();
    const { id } = (await store.start(async () => c.run)) as { id: string };
    const frames = collect(store, id);
    for (const e of [runStarted, paymentRequired, received, feedback, runFinished]) c.push(e);
    await tick();
    expect(frames.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(frames.map((f) => f.source))).toEqual(new Set(['live']));
    expect(store.get(id)).toMatchObject({ status: 'finished', llm: 'scripted', before: balances, after: settled });
  });

  it('turns a throw into a synthetic run.finished error and frees the slot', async () => {
    const store = createRunStore();
    const c = controlled();
    const { id } = (await store.start(async () => c.run)) as { id: string };
    const frames = collect(store, id);
    for (const e of [runStarted, paymentRequired, received]) c.push(e);
    c.fail(new Error('boom at http://127.0.0.1:8545'));
    await tick();
    expect(frames).toHaveLength(4);
    expect(frames[3]?.event).toMatchObject({ type: 'run.finished', reason: 'error', message: 'boom at [url]' });
    expect(await store.start(async () => controlled().run)).toHaveProperty('id');
  });

  it('adds run.finished error when the stream ends without one', async () => {
    const store = createRunStore();
    const c = controlled();
    const { id } = (await store.start(async () => c.run)) as { id: string };
    const frames = collect(store, id);
    c.push(runStarted);
    c.end();
    await tick();
    expect(frames.at(-1)?.event).toMatchObject({ type: 'run.finished', reason: 'error' });
  });

  it('replays buffered frames after a Last-Event-ID, then goes live', async () => {
    const store = createRunStore();
    const c = controlled();
    const { id } = (await store.start(async () => c.run)) as { id: string };
    for (const e of [runStarted, paymentRequired, received]) c.push(e);
    await tick();
    const frames = collect(store, id, 2);
    expect(frames.map((f) => f.seq)).toEqual([3]);
    c.push(feedback);
    await tick();
    expect(frames.map((f) => f.seq)).toEqual([3, 4]);
  });

  it('returns undefined for an unknown id and stops delivering after unsubscribe', async () => {
    const store = createRunStore();
    expect(store.subscribe('nope', 0, () => {})).toBeUndefined();
    const c = controlled();
    const { id } = (await store.start(async () => c.run)) as { id: string };
    const seen: Envelope[] = [];
    const off = store.subscribe(id, 0, (f) => seen.push(f)) as () => void;
    off();
    c.push(runStarted);
    await tick();
    expect(seen).toEqual([]);
  });

  it('keeps the same store across a module reload', async () => {
    const first = getRunStore();
    vi.resetModules();
    const again = await import('./run-store.ts');
    expect(again.getRunStore()).toBe(first);
  });
});
