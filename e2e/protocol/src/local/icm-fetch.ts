import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gitIn } from './icm-services.ts';

const run = promisify(execFile);

export const ICM_COMMIT = '34deb30f7ddb4e6fecfd1132b413d09570610851';
export const ICM_REPO = 'https://github.com/ava-labs/icm-services.git';
const BUILT_MARKER = '.built';

export interface IcmSteps {
  fetch: (dir: string) => Promise<void>;
  build: (dir: string) => Promise<void>;
}

export function icmCacheDir(projectRoot: string, commit: string): string {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('icm-services commit must be 40 hex characters');
  return join(projectRoot, '.cache', 'icm-services', commit);
}

// A fixed environment for forge: no inherited variables reach the clone's build.
const buildEnv = (): NodeJS.ProcessEnv => ({
  PATH: `${join(homedir(), '.foundry', 'bin')}:/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin`,
  HOME: homedir(),
  LC_ALL: 'C',
});

async function fetchPinned(dir: string, projectRoot: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const init = { env: { PATH: '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin', LC_ALL: 'C' }, shell: false };
  await run('git', ['init', '-q', dir], init);
  await gitIn(dir, projectRoot, ['fetch', '--depth', '1', ICM_REPO, ICM_COMMIT]);
  await gitIn(dir, projectRoot, ['checkout', '-q', '--detach', 'FETCH_HEAD']);
  const head = await gitIn(dir, projectRoot, ['rev-parse', 'HEAD']);
  if (head !== ICM_COMMIT) throw new Error(`fetched ${head}, expected ${ICM_COMMIT}`);
  await gitIn(dir, projectRoot, ['submodule', 'update', '--init', '--recursive', '--depth', '1']);
}

async function buildClone(dir: string): Promise<void> {
  await run('forge', ['build'], { cwd: dir, env: buildEnv(), shell: false, maxBuffer: 64 * 1024 * 1024 });
}

// Returns 'hit' when the build marker exists (no network), 'built' after a fetch and build.
export async function ensureIcmServices(
  projectRoot: string,
  commit: string,
  steps: IcmSteps,
): Promise<'hit' | 'built'> {
  const dir = icmCacheDir(projectRoot, commit);
  if (existsSync(join(dir, BUILT_MARKER))) return 'hit';
  if (!existsSync(join(dir, '.git'))) await steps.fetch(dir);
  await steps.build(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, BUILT_MARKER), '');
  return 'built';
}

if (import.meta.main) {
  const projectRoot = resolve(import.meta.dirname, '../../../..');
  const result = await ensureIcmServices(projectRoot, ICM_COMMIT, {
    fetch: (dir) => fetchPinned(dir, projectRoot),
    build: buildClone,
  });
  console.log(`icm-services ${ICM_COMMIT}: ${result}`);
}
