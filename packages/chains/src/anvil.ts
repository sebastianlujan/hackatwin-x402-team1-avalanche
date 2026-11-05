import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { ChainError } from './chain-error.ts';

const HOST = '127.0.0.1';
const POLL_MS = 250;

export interface AnvilOptions {
  readonly upstream: string;
  readonly forkBlock: bigint;
  readonly port?: number;
}

// The upstream URL is never echoed in an error: it may carry an API key.
export function anvilArgs({ upstream, forkBlock, port = 8545 }: AnvilOptions): string[] {
  if (!isHttp(upstream)) throw new ChainError('anvil upstream must be an http(s) URL');
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new ChainError(`anvil port ${port} is out of range`);
  if (forkBlock <= 0n) throw new ChainError('anvil fork block must be positive');
  return [
    ...['--fork-url', upstream, '--fork-block-number', String(forkBlock), '--chain-id', '43114'],
    ...['--hardfork', 'cancun', '--host', HOST, '--port', String(port)],
  ];
}

const isHttp = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};

export interface StartAnvilOptions extends AnvilOptions {
  readonly logFile?: string;
  readonly readyTimeoutMs?: number;
  readonly spawn?: typeof spawn;
}

export interface StartedAnvil {
  readonly pid: number;
  readonly url: string;
}

const isReady = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'web3_clientVersion', params: [] }),
    });
    return /anvil/i.test(((await response.json()) as { result?: string }).result ?? '');
  } catch {
    return false;
  }
};

// Spawns a detached anvil with no shell and waits until it answers; a timeout or early exit kills it.
export async function startAnvil(options: StartAnvilOptions): Promise<StartedAnvil> {
  const args = anvilArgs(options);
  const url = `http://${HOST}:${options.port ?? 8545}`;
  const log = options.logFile === undefined ? 'ignore' : openSync(options.logFile, 'a', 0o600);
  let child: ChildProcess;
  try {
    child = (options.spawn ?? spawn)('anvil', args, { shell: false, detached: true, stdio: ['ignore', log, log] });
  } finally {
    if (typeof log === 'number') closeSync(log);
  }
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  child.once('error', () => {
    exited = true;
  });
  const deadline = Date.now() + (options.readyTimeoutMs ?? 60_000);
  while (Date.now() < deadline && !exited) {
    if (await isReady(url)) {
      child.unref();
      return { pid: child.pid as number, url };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  child.kill('SIGINT');
  throw new ChainError(exited ? 'anvil exited before it was ready' : 'anvil was not ready before the timeout');
}
