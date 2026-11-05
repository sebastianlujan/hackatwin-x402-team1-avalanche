import { describe, expect, it, vi } from 'vitest';
import { feedback, paymentRequired, runFinished, runStarted } from '../../test/events.ts';
import { type Envelope, encodeFrame } from './envelope.ts';
import { CLAUDE_DISABLED_REASON, createStarter, initialStream, modeBadge, streamReducer } from './starter.ts';

const reply = (status: number, body: unknown): Response => Response.json(body, { status });
const frame = (seq: number, event = paymentRequired): string => encodeFrame({ seq, source: 'live', event });

describe('starter', () => {
  it('sends one POST for two quick presses', async () => {
    const post = vi.fn(async () => reply(202, { id: 'r1' }));
    const starter = createStarter(post);
    const [first, second] = await Promise.all([starter.press('scripted'), starter.press('scripted')]);
    expect(first).toEqual({ type: 'started', id: 'r1' });
    expect(second).toEqual({ type: 'ignored' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(await starter.press('scripted')).toEqual({ type: 'ignored' });
    starter.release();
    await starter.press('scripted');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('attaches to the active run on 409', async () => {
    const starter = createStarter(vi.fn(async () => reply(409, { id: 'r0' })));
    expect(await starter.press('claude')).toEqual({ type: 'active', id: 'r0' });
  });

  it('returns the command text on an error and allows a retry', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(reply(503, { error: 'run pnpm demo1:fund' }))
      .mockResolvedValue(reply(202, { id: 'r2' }));
    const starter = createStarter(post);
    expect(await starter.press('claude')).toEqual({ type: 'error', message: 'run pnpm demo1:fund' });
    expect(await starter.press('claude')).toEqual({ type: 'started', id: 'r2' });
  });

  it('states why Claude is disabled', () => {
    expect(CLAUDE_DISABLED_REASON).toContain('ANTHROPIC_API_KEY');
  });
});

describe('streamReducer', () => {
  it('appends frames, dedupes by seq and finishes on run.finished', () => {
    let state = streamReducer(initialStream, { type: 'frame', data: frame(1, runStarted) });
    state = streamReducer(state, { type: 'frame', data: frame(2) });
    state = streamReducer(state, { type: 'frame', data: frame(2) });
    expect(state.frames.map((f: Envelope) => f.seq)).toEqual([1, 2]);
    state = streamReducer(state, { type: 'frame', data: frame(3, runFinished) });
    expect(state.status).toBe('finished');
  });

  it('shows Reconnecting on a drop and goes live again on the next frame', () => {
    const live = streamReducer(initialStream, { type: 'frame', data: frame(1, runStarted) });
    const dropped = streamReducer(live, { type: 'drop', closed: false });
    expect(dropped.status).toBe('reconnecting');
    expect(streamReducer(dropped, { type: 'frame', data: frame(2) }).status).toBe('live');
    expect(streamReducer(dropped, { type: 'drop', closed: true }).status).toBe('error');
  });

  it('keeps a finished run finished after a late drop', () => {
    const done = streamReducer(initialStream, { type: 'frame', data: frame(1, runFinished) });
    expect(streamReducer(done, { type: 'drop', closed: false })).toBe(done);
  });

  it('enters an error state on an undecodable frame', () => {
    const bad = JSON.stringify({ seq: 1, source: 'live', event: JSON.stringify({ version: 2, type: 'run.finished' }) });
    const state = streamReducer(initialStream, { type: 'frame', data: bad });
    expect(state.status).toBe('error');
    expect(state.error).toContain('version');
  });

  it('badges a scripted run from run.started', () => {
    const scripted = [{ seq: 1, source: 'live', event: runStarted }] as const;
    expect(modeBadge(scripted)).toBe('Scripted');
    expect(modeBadge([{ seq: 1, source: 'live', event: feedback }])).toBeUndefined();
    expect(
      modeBadge([{ seq: 1, source: 'live', event: { ...runStarted, llm: 'claude' } as typeof runStarted }]),
    ).toBeUndefined();
  });
});
