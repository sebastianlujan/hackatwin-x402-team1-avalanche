import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureIcmServices, ICM_COMMIT, icmCacheDir } from '../../src/local/icm-fetch.ts';

const made: string[] = [];
const tempRoot = (): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'icm-fetch-')));
  made.push(dir);
  return dir;
};
const steps = () => {
  const calls: string[] = [];
  return { calls, fetch: async () => void calls.push('fetch'), build: async () => void calls.push('build') };
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('icmCacheDir', () => {
  it('places the clone under .cache/icm-services/<commit>', () => {
    expect(icmCacheDir('/repo', ICM_COMMIT)).toBe(`/repo/.cache/icm-services/${ICM_COMMIT}`);
  });

  it('refuses a commit that is not 40 hex characters', () => {
    expect(() => icmCacheDir('/repo', '../escape')).toThrow(/40 hex/);
  });
});

describe('ensureIcmServices', () => {
  it('fetches then builds when nothing is cached', async () => {
    const s = steps();
    expect(await ensureIcmServices(tempRoot(), ICM_COMMIT, s)).toBe('built');
    expect(s.calls).toEqual(['fetch', 'build']);
  });

  it('does no network fetch on a cache hit', async () => {
    const root = tempRoot();
    const dir = icmCacheDir(root, ICM_COMMIT);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.built'), '');
    const s = steps();
    expect(await ensureIcmServices(root, ICM_COMMIT, s)).toBe('hit');
    expect(s.calls).toEqual([]);
  });

  it('rebuilds without refetching when the clone exists but the build marker is missing', async () => {
    const root = tempRoot();
    mkdirSync(join(icmCacheDir(root, ICM_COMMIT), '.git'), { recursive: true });
    const s = steps();
    expect(await ensureIcmServices(root, ICM_COMMIT, s)).toBe('built');
    expect(s.calls).toEqual(['build']);
  });
});
