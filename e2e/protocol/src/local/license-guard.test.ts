import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertNoEcosystemLicense, ecosystemHeader, trackedEcosystemFiles } from './license-guard.ts';

const made: string[] = [];
const repoWith = (files: Record<string, string>): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'license-guard-')));
  made.push(dir);
  execFileSync('git', ['init', '-q', dir]);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  execFileSync('git', ['-C', dir, 'add', '.']);
  return dir;
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('license guard', () => {
  it('names a tracked file that carries the SPDX header', async () => {
    const repo = repoWith({ 'Vendored.sol': `// ${ecosystemHeader}\ncontract A {}\n`, 'Own.sol': 'contract B {}\n' });
    expect(await trackedEcosystemFiles(repo)).toEqual(['Vendored.sol']);
    await expect(assertNoEcosystemLicense(repo)).rejects.toThrow(/Vendored\.sol/);
  });

  it('allows a doc that mentions the bare token', async () => {
    const repo = repoWith({ 'notes.md': 'The files use LicenseRef-Ecosystem and must never be committed.\n' });
    expect(await trackedEcosystemFiles(repo)).toEqual([]);
    await expect(assertNoEcosystemLicense(repo)).resolves.toBeUndefined();
  });

  it('ignores an untracked file with the header', async () => {
    const repo = repoWith({ 'tracked.md': 'plain\n' });
    writeFileSync(join(repo, 'loose.sol'), `// ${ecosystemHeader}\n`);
    expect(await trackedEcosystemFiles(repo)).toEqual([]);
  });

  it('passes on this repository', async () => {
    const root = join(import.meta.dirname, '../../../..');
    await expect(assertNoEcosystemLicense(root)).resolves.toBeUndefined();
  });
});
