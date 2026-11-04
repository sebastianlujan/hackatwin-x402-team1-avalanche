import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGuardedClients } from '@hackatwin/chains';
import { CCHAIN_FORK_BLOCK } from '@hackatwin/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ForkResult, startFork } from './fork.ts';

const PORT = 8546;
const dir = join(mkdtempSync(join(tmpdir(), 'fork-live-')), '.demo1');
let started: ForkResult;

const stopped = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
};

beforeAll(async () => {
  started = await startFork({ dir, port: PORT });
});

// SIGINT lets anvil flush its RPC cache before the CI cache step saves it.
afterAll(async () => {
  if (started.pid === undefined) return;
  process.kill(started.pid, 'SIGINT');
  for (let i = 0; i < 100 && !stopped(started.pid); i++) await new Promise((resolve) => setTimeout(resolve, 100));
});

describe('live fork', () => {
  it('serves chain 43114 at block N or later on loopback anvil with a synced clock', async () => {
    const clients = await createGuardedClients({ chain: 'cchain', rpcUrl: started.url });
    expect(clients.refusal).toBeUndefined();
    expect(await clients.public.getBlockNumber()).toBeGreaterThanOrEqual(CCHAIN_FORK_BLOCK);
    expect(await clients.cheats().forkBlock()).toBe(CCHAIN_FORK_BLOCK);
    const head = (await clients.public.getBlock()).timestamp;
    expect(Number(head)).toBeGreaterThan(Date.now() / 1000 - 60);
  });

  it('runs the cheats against the fork', async () => {
    const clients = await createGuardedClients({ chain: 'cchain', rpcUrl: started.url });
    const who = '0x00000000000000000000000000000000000000a1';
    await clients.cheats().setBalance(who, 10n ** 19n);
    expect(await clients.public.getBalance({ address: who })).toBe(10n ** 19n);
  });

  it('is a no-op on a rerun and starts no second anvil', async () => {
    const again = await startFork({ dir, port: PORT });
    expect(again).toMatchObject({ reused: true, pid: undefined });
    expect(started.keystores.every((keystore) => keystore.created)).toBe(true);
    expect(again.keystores.every((keystore) => !keystore.created)).toBe(true);
  });
});
