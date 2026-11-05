import { writeFileSync } from 'node:fs';
import { type AgentEvent, encodeAgentEvent } from '@hackatwin/core';

export class RecordingError extends Error {
  override readonly name = 'RecordingError';
}

// One JSON line per event; a simulated event is refused before anything is encoded.
export function encodeRecording(events: readonly AgentEvent[]): string {
  const index = events.findIndex((event) => event.simulated !== undefined);
  if (index >= 0) throw new RecordingError(`event ${index + 1} is simulated: simulated runs are never recorded`);
  return events.map((event) => `${encodeAgentEvent(event)}\n`).join('');
}

export function saveRecording(path: string, events: readonly AgentEvent[]): void {
  writeFileSync(path, encodeRecording(events));
}
