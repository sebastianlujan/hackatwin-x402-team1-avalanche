import { type AgentEvent, AgentEventError, decodeAgentEvent, encodeAgentEvent } from '@hackatwin/core';

export type Source = 'live' | 'replay';

export interface Envelope {
  readonly seq: number;
  readonly source: Source;
  readonly event: AgentEvent;
}

// The wire event is the encodeAgentEvent string, so bigints stay decimal strings.
export const encodeFrame = (e: Envelope): string =>
  JSON.stringify({ seq: e.seq, source: e.source, event: encodeAgentEvent(e.event) });

export function decodeFrame(data: string): Envelope {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    throw new AgentEventError('Frame is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new AgentEventError('Frame must be an object');
  const frame = raw as Record<string, unknown>;
  const { seq, source, event } = frame;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
    throw new AgentEventError('Frame seq must be an integer from 1');
  }
  if (source !== 'live' && source !== 'replay') throw new AgentEventError('Frame source must be live or replay');
  if (typeof event !== 'string') throw new AgentEventError('Frame event must be an encoded string');
  return { seq, source, event: decodeAgentEvent(event) };
}
