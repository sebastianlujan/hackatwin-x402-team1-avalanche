import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertOwnRepo, gitIn } from '../../src/local/icm-services.ts';

const made: string[] = [];
const tempDir = (): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'icm-git-')));
  made.push(dir);
  return dir;
};
const tempRepo = (): string => {
  const dir = tempDir();
  execFileSync('git', ['init', '-q', dir]);
  return dir;
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('assertOwnRepo', () => {
  it('refuses a relative path', async () => {
    await expect(assertOwnRepo('.cache/icm-services', tempRepo())).rejects.toThrow(/absolute/);
  });

  it('refuses a directory equal to the project root', async () => {
    const root = tempRepo();
    await expect(assertOwnRepo(root, root)).rejects.toThrow(/project root/);
  });

  it('refuses a directory inside the project repository that is not its own repository', async () => {
    const root = tempRepo();
    const nested = join(root, '.cache', 'icm-services');
    mkdirSync(nested, { recursive: true });
    await expect(assertOwnRepo(nested, root)).rejects.toThrow(/own repository/);
  });

  it('refuses a directory that does not exist', async () => {
    await expect(assertOwnRepo(join(tempDir(), 'missing'), tempRepo())).rejects.toThrow(/own repository/);
  });

  it('accepts an absolute directory that is its own repository root', async () => {
    const dir = tempRepo();
    await expect(assertOwnRepo(dir, tempRepo())).resolves.toBe(dir);
  });
});

describe('gitIn', () => {
  it('runs git inside the checked directory only', async () => {
    const dir = tempRepo();
    expect(await gitIn(dir, tempRepo(), ['rev-parse', '--is-inside-work-tree'])).toBe('true');
  });

  it('refuses before running git when the check fails', async () => {
    const root = tempRepo();
    await expect(gitIn(root, root, ['status'])).rejects.toThrow(/project root/);
  });
});
