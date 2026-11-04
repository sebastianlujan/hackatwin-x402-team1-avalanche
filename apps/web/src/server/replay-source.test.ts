import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sourceLabel } from '../lib/envelope.ts';
import { readReplay, replayEnvelopes } from './replay-source.ts';

const fixture = (name: string): string => join(import.meta.dirname, '../../test/fixtures', name);

describe('replay source', () => {
  it('emits every fixture frame as replay with the Replay label', () => {
    const frames = readReplay(fixture('replay.jsonl'));
    expect(frames.map((f) => f.seq)).toEqual([1, 2, 3, 4]);
    expect(new Set(frames.map((f) => f.source))).toEqual(new Set(['replay']));
    expect(frames.map((f) => sourceLabel(f.source))).toEqual(Array(4).fill('Replay'));
    expect(sourceLabel('live')).toBeUndefined();
  });

  it('ends a bad line with a run.finished error naming line 3', () => {
    const frames = readReplay(fixture('replay-bad-line.jsonl'));
    expect(frames).toHaveLength(3);
    expect(frames[2]?.event).toMatchObject({ type: 'run.finished', reason: 'error' });
    expect(JSON.stringify(frames[2]?.event)).toContain('line 3');
  });
});

describe('replay of marked events', () => {
  const real = '{"version":1,"type":"llm.reasoning","at":1,"text":"hi"}';
  const marked = '{"version":1,"type":"llm.reasoning","at":2,"text":"sim","simulated":"local-crosschain"}';

  it('ends at the marked line with a run.finished error naming line 2', () => {
    const frames = replayEnvelopes(`${real}\n${marked}\n${real}`);
    expect(frames.map((f) => f.event.type)).toEqual(['llm.reasoning', 'run.finished']);
    expect(frames[1]?.event).toMatchObject({ type: 'run.finished', reason: 'error' });
    expect(JSON.stringify(frames[1]?.event)).toMatch(/line 2.*simulated/);
  });

  it('replays unmarked lines in full', () => {
    expect(replayEnvelopes(`${real}\n${real}`).map((f) => f.event.type)).toEqual(['llm.reasoning', 'llm.reasoning']);
  });
});
