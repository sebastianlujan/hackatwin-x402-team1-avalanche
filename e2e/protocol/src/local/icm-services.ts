import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// No inherited GIT_DIR or config: git sees only the directory it is pointed at.
const gitEnv = (): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LC_ALL: 'C',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
});

const git = async (args: string[]): Promise<string> =>
  (await run('git', args, { env: gitEnv(), shell: false, encoding: 'utf8' })).stdout.trim();

// Returns the real path of `dir` only if it is absolute and is the root of its own repository.
export async function assertOwnRepo(dir: string, projectRoot: string): Promise<string> {
  if (!isAbsolute(dir)) throw new Error('cache directory must be an absolute path');
  const root = await realpath(projectRoot);
  const real = await realpath(dir).catch(() => undefined);
  if (real === root) throw new Error('cache directory is the project root');
  const top =
    real === undefined ? undefined : await git(['-C', real, 'rev-parse', '--show-toplevel']).catch(() => undefined);
  if (real === undefined || top === undefined || (await realpath(top)) !== real)
    throw new Error('cache directory is not its own repository root');
  return real;
}

// Runs git in a checked cache directory with `git -C <abs>`, never in the project repository.
export async function gitIn(dir: string, projectRoot: string, args: string[]): Promise<string> {
  const real = await assertOwnRepo(dir, projectRoot);
  return git(['-C', real, ...args]);
}
