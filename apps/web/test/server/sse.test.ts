import { describe, expect, it } from 'vitest';
import { createRunStore } from '../../src/server/run-store.ts';
import { eventsResponse } from '../../src/server/sse.ts';
import { feedback, paymentRequired, received, runFinished, runStarted } from '../events.ts';
import { finite, hanging, tick } from '../runs.ts';

const seven = [runStarted, paymentRequired, received, feedback, received, feedback, runFinished];

async function finishedStore() {
  const store = createRunStore();
  const { id } = (await store.start(async () => finite(seven))) as { id: string };
  await tick();
  return { store, id };
}

const ids = (text: string): number[] => [...text.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));

describe('eventsResponse', () => {
  it('sends the stream headers', async () => {
    const { store, id } = await finishedStore();
    const res = eventsResponse({ store, id, lastEventId: null, signal: new AbortController().signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-transform');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    expect(await res.text()).toContain('retry: 1000');
  });

  it('replays all frames with ids and closes after run.finished', async () => {
    const { store, id } = await finishedStore();
    const res = eventsResponse({ store, id, lastEventId: null, signal: new AbortController().signal });
    const text = await res.text();
    expect(ids(text)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(text).toContain('data: {"seq":1,"source":"live"');
  });

  it('resumes after Last-Event-ID 4 with frames 5 to 7', async () => {
    const { store, id } = await finishedStore();
    const res = eventsResponse({ store, id, lastEventId: '4', signal: new AbortController().signal });
    expect(ids(await res.text())).toEqual([5, 6, 7]);
  });

  it('only unsubscribes on abort and leaves the run active', async () => {
    const store = createRunStore();
    const { id } = (await store.start(async () => hanging())) as { id: string };
    const abort = new AbortController();
    const res = eventsResponse({ store, id, lastEventId: null, signal: abort.signal, heartbeatMs: 1 });
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('retry');
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(': ping');
    abort.abort();
    expect((await reader.read()).done).toBe(true);
    expect(store.get(id)?.status).toBe('running');
  });
});
