import 'server-only';
import { readFileSync } from 'node:fs';
import { AgentEventError, decodeAgentEvent } from '@hackatwin/core';
import type { Envelope } from '../lib/envelope.ts';

// A bad line ends the replay with a run.finished error that names the line.
export function replayEnvelopes(jsonl: string, at = Date.now()): Envelope[] {
  const frames: Envelope[] = [];
  const lines = jsonl.split('\n');
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') continue;
    try {
      const event = decodeAgentEvent(line);
      if (event.simulated !== undefined) throw new AgentEventError('simulated runs are never replays');
      frames.push({ seq: frames.length + 1, source: 'replay', event });
    } catch (error) {
      const reason = error instanceof AgentEventError ? error.message : 'unreadable';
      const failure = {
        version: 1,
        type: 'run.finished',
        at,
        reason: 'error',
        message: `Replay line ${index + 1}: ${reason}`,
      } as const;
      return [...frames, { seq: frames.length + 1, source: 'replay', event: failure }];
    }
  }
  return frames;
}

export const readReplay = (path: string): Envelope[] => replayEnvelopes(readFileSync(path, 'utf8'));
