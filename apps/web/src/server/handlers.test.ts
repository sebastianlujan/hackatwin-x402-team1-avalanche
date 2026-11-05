import type { AgentEvent } from '@hackatwin/core';
import { describe, expect, it, vi } from 'vitest';
import { runFinished, runStarted } from '../../test/events.ts';
import { finite, hanging, tick } from '../../test/runs.ts';
import { createEventsHandler, createRunHandler, createStartHandler } from './handlers.ts';
import { createRunStore } from './run-store.ts';

const post = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('http://web/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function setup(open = vi.fn(async () => hanging()), hasKey = true) {
  const store = createRunStore();
  const start = createStartHandler({ store, open, hasAnthropicKey: () => hasKey });
  return { store, open, start };
}

describe('start handler', () => {
  it('answers 202 with the id and 409 with the active id', async () => {
    const { start, open } = setup();
    const first = await start(post({ llm: 'scripted' }));
    const { id } = (await first.json()) as { id: string };
    expect(first.status).toBe(202);
    const second = await start(post({ llm: 'scripted' }));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ id });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('allows the same origin and a request with no Origin header', async () => {
    const { start, open } = setup(vi.fn(async () => finite([])));
    expect((await start(post({ llm: 'scripted' }, { origin: 'http://web' }))).status).toBe(202);
    await tick();
    expect((await start(post({ llm: 'scripted' }))).status).not.toBe(403);
    expect(open).toHaveBeenCalled();
  });

  it('answers 403 for a foreign origin and runs nothing', async () => {
    const { start, open } = setup();
    const res = await start(post({ llm: 'scripted' }, { origin: 'http://evil.example' }));
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain('evil');
    expect(open).not.toHaveBeenCalled();
  });

  it('answers 415 when the content type is not JSON', async () => {
    const { start, open } = setup();
    const res = await start(post({ llm: 'scripted' }, { 'content-type': 'text/plain' }));
    expect(res.status).toBe(415);
    expect(open).not.toHaveBeenCalled();
  });

  it('answers 400 for a bad body or llm', async () => {
    const { start, open } = setup();
    for (const body of ['nope', {}, { llm: 'gpt' }]) expect((await start(post(body))).status).toBe(400);
    expect(open).not.toHaveBeenCalled();
  });

  it('answers 422 naming ANTHROPIC_API_KEY before any chain call', async () => {
    const { start, open } = setup(undefined, false);
    const res = await start(post({ llm: 'claude' }));
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).toContain('ANTHROPIC_API_KEY');
    expect(open).not.toHaveBeenCalled();
  });

  it('answers 503 with the fixing command, redacted, and creates no run', async () => {
    const error = new Error('the seller is not running: run pnpm demo1:seller (http://127.0.0.1:4021)');
    const { start, store } = setup(vi.fn(async () => Promise.reject(error)));
    const res = await start(post({ llm: 'scripted' }));
    const text = JSON.stringify(await res.json());
    expect(res.status).toBe(503);
    expect(text).toContain('pnpm demo1:seller');
    expect(text).not.toContain('127.0.0.1');
    expect(store.latest()).toBeUndefined();
  });

  it('relays a fork guard refusal as 503', async () => {
    const { start } = setup(vi.fn(async () => Promise.reject(new Error('the RPC is not a local anvil fork: remote'))));
    const res = await start(post({ llm: 'scripted' }));
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).toContain('not a local anvil fork');
  });
});

describe('read handlers', () => {
  it('never start a run and answer 404 for an unknown id', async () => {
    const { store, open } = setup();
    const run = createRunHandler({ store });
    const events = createEventsHandler({ store });
    expect((await run(new Request('http://web/api/runs/x'), ctx('x'))).status).toBe(404);
    expect((await events(new Request('http://web/api/runs/x/events'), ctx('x'))).status).toBe(404);
    expect(open).not.toHaveBeenCalled();
    expect(store.latest()).toBeUndefined();
  });

  it('answers 200 with decimal-string balances', async () => {
    const { store, start } = setup(vi.fn(async () => finite([runStarted, runFinished])));
    const { id } = (await (await start(post({ llm: 'scripted' }))).json()) as { id: string };
    await tick();
    const res = await createRunHandler({ store })(new Request('http://web/api/runs/x'), ctx(id));
    expect(await res.json()).toEqual({
      id,
      status: 'finished',
      llm: 'scripted',
      before: { agent: '10', seller: '0' },
      after: { agent: '7', seller: '3' },
    });
  });

  it('streams a known run and redacts a finished message', async () => {
    const failed: AgentEvent = {
      version: 1,
      type: 'run.finished',
      at: 1,
      reason: 'error',
      message: 'failed at http://127.0.0.1:8545',
    };
    const { store, start } = setup(vi.fn(async () => finite([runStarted, failed])));
    const { id } = (await (await start(post({ llm: 'scripted' }))).json()) as { id: string };
    await tick();
    const res = await createEventsHandler({ store })(new Request('http://web/api/runs/x/events'), ctx(id));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('[url]');
    expect(text).not.toContain('127.0.0.1');
  });
});
