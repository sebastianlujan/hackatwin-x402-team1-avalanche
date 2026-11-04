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
      frames.push({ seq: frames.length + 1, source: 'replay', event: decodeAgentEvent(line) });
    } catch (error) {
      const reason = error instanceof AgentEventError ? error.message : 'unreadable';
      const event = {
        version: 1,
        type: 'run.finished',
        at,
        reason: 'error',
        message: `Replay line ${index + 1}: ${reason}`,
      } as const;
      return [...frames, { seq: frames.length + 1, source: 'replay', event }];
    }
  }
  return frames;
}

export const readReplay = (path: string): Envelope[] => replayEnvelopes(readFileSync(path, 'utf8'));
