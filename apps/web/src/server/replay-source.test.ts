import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sourceLabel } from '../lib/envelope.ts';
import { readReplay } from './replay-source.ts';

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
