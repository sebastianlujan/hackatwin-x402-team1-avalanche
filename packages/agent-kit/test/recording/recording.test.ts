import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type AgentEvent, decodeAgentEvent } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { encodeRecording, RecordingError, saveRecording } from '../../src/recording/recording.ts';

const real: AgentEvent[] = [
  { version: 1, type: 'run.started', at: 1, agent: 'buyer', profile: 'fuji-cchain', llm: 'scripted' },
  { version: 1, type: 'run.finished', at: 2, reason: 'done' },
];
const marked: AgentEvent[] = real.map((event) => ({ ...event, simulated: 'local-crosschain' }));
const target = (): string => join(mkdtempSync(join(tmpdir(), 'recording-')), 'run.jsonl');

describe('saveRecording', () => {
  it('writes a real run as one decodable line per event', () => {
    const path = target();
    saveRecording(path, real);
    const lines = readFileSync(path, 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => decodeAgentEvent(line))).toEqual(real);
  });

  it('refuses a simulated run and writes no file', () => {
    const path = target();
    expect(() => saveRecording(path, marked)).toThrow(RecordingError);
    expect(() => saveRecording(path, marked)).toThrow(/simulated/);
    expect(existsSync(path)).toBe(false);
  });

  it('refuses a run with one marked event among real ones', () => {
    const path = target();
    expect(() => saveRecording(path, [real[0] as AgentEvent, marked[1] as AgentEvent])).toThrow(/event 2/);
    expect(existsSync(path)).toBe(false);
  });
});

describe('encodeRecording', () => {
  it('refuses marked events before it encodes anything', () => {
    expect(() => encodeRecording(marked)).toThrow(/never recorded/);
    expect(encodeRecording(real).split('\n').filter(Boolean)).toHaveLength(2);
  });
});
