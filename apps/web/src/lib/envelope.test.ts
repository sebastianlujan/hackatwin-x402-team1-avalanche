import { AgentEventError } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { paymentRequired } from '../../test/events.ts';
import { decodeFrame, encodeFrame } from './envelope.ts';

describe('envelope', () => {
  it('round trips a live payment.required with bigint amounts', () => {
    const frame = decodeFrame(encodeFrame({ seq: 1, source: 'live', event: paymentRequired }));
    expect(frame.source).toBe('live');
    expect(frame.event).toEqual(paymentRequired);
  });

  it('accepts live and replay with one schema, differing only in source', () => {
    const live = decodeFrame(encodeFrame({ seq: 2, source: 'live', event: paymentRequired }));
    const replay = decodeFrame(encodeFrame({ seq: 2, source: 'replay', event: paymentRequired }));
    expect({ ...live, source: 'replay' }).toEqual(replay);
  });

  it('throws AgentEventError for version 2', () => {
    const event = JSON.stringify({ version: 2, type: 'run.finished', at: 1, reason: 'done' });
    const data = JSON.stringify({ seq: 1, source: 'live', event });
    expect(() => decodeFrame(data)).toThrow(AgentEventError);
  });

  it.each([
    ['not json', 'nope'],
    ['seq zero', JSON.stringify({ seq: 0, source: 'live', event: '{}' })],
    ['bad source', JSON.stringify({ seq: 1, source: 'other', event: '{}' })],
    ['event not a string', JSON.stringify({ seq: 1, source: 'live', event: {} })],
  ])('rejects a frame that is %s', (_name, data) => {
    expect(() => decodeFrame(data)).toThrow(AgentEventError);
  });
});
