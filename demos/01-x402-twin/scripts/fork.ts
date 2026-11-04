import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChainError, chain, createChainClient, createGuardedClients, startAnvil } from '@hackatwin/chains';
import { CCHAIN_FORK_BLOCK, type Env, keystoreNamedInEnv, loadRpcUrls } from '@hackatwin/config';
import { ensureRoleKeystore, ensureStateDir, ROLES, type RoleKeystore, writeDemoEnv } from '../state.ts';
import { STATE_DIR } from '../state-dir.ts';

export interface ForkOptions {
  readonly dir?: string;
  readonly port?: number;
  readonly env?: Env;
}

export interface ForkResult {
  readonly url: string;
  readonly pid: number | undefined;
  readonly reused: boolean;
  readonly keystores: readonly RoleKeystore[];
}

export class ForkError extends Error {
  override readonly name = 'ForkError';
}

const nowSeconds = (): bigint => BigInt(Math.floor(Date.now() / 1000));

// A fork already serving N is reused; any other server on the port is an error.
async function runningFork(url: string): Promise<bigint | undefined> {
  let clients: Awaited<ReturnType<typeof createGuardedClients>>;
  try {
    clients = await createGuardedClients({ chain: 'cchain', rpcUrl: url });
  } catch (error) {
    if (error instanceof ChainError) throw new ForkError(error.message);
    return undefined;
  }
  const block = await clients.cheats().forkBlock();
  if (block !== CCHAIN_FORK_BLOCK)
    throw new ForkError(`the RPC on ${url} is not an anvil fork at block ${CCHAIN_FORK_BLOCK}`);
  await clients.cheats().syncClock(nowSeconds());
  return block;
}

// The upstream URL stays out of the message: it may carry an API key.
async function assertUpstreamServes(upstream: string): Promise<void> {
  const entry = chain('cchain');
  const permit2 = entry.contracts.permit2?.address;
  try {
    const reader = await createChainClient({ chain: 'cchain', rpcUrl: upstream });
    if (permit2 !== undefined && (await reader.codeSize(permit2, CCHAIN_FORK_BLOCK)) > 0) return;
  } catch {}
  throw new ForkError(`the upstream RPC cannot serve block ${CCHAIN_FORK_BLOCK}`);
}

export async function startFork({ dir = STATE_DIR, port = 8545, env }: ForkOptions = {}): Promise<ForkResult> {
  const url = `http://127.0.0.1:${port}`;
  ensureStateDir(dir);
  // A role the env names is the user's, unless that name is our own file from an earlier run (demo1.env).
  const ours = ROLES.filter((role) => !keystoreNamedInEnv(role, env) || existsSync(join(dir, role)));
  const keystores = ours.map((role) => ensureRoleKeystore(dir, role));
  writeDemoEnv(dir, url, keystores);
  if ((await runningFork(url)) !== undefined) return { url, pid: undefined, reused: true, keystores };
  const entry = chain('cchain');
  const { cchain: upstream } = loadRpcUrls({ cchain: entry.rpc?.public }, env);
  await assertUpstreamServes(upstream as string);
  const { pid } = await startAnvil({
    upstream: upstream as string,
    forkBlock: CCHAIN_FORK_BLOCK,
    port,
    logFile: join(dir, 'anvil.log'),
  });
  writeFileSync(join(dir, 'anvil.pid'), `${pid}\n`);
  const clients = await createGuardedClients({ chain: 'cchain', rpcUrl: url });
  await clients.cheats().syncClock(nowSeconds());
  return { url, pid, reused: false, keystores };
}

if (import.meta.main) {
  try {
    const { url, pid, reused, keystores } = await startFork();
    for (const { role, address, created } of keystores) console.log(`${role} ${address}${created ? ' (new)' : ''}`);
    console.log(`${reused ? 'fork already running' : `anvil pid ${pid}`} at block ${CCHAIN_FORK_BLOCK} on ${url}`);
  } catch (error) {
    console.error(`fork failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
