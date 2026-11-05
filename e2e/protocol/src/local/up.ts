import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { startLocalAnvil } from '@hackatwin/chains';
import { assertDistinctChainIds, LOCAL_HUB, LOCAL_L1 } from './anvils.ts';
import { type Deployed, deployScripts, mintTreasury } from './deploy.ts';
import type { ForgeRunner } from './forge.ts';
import { forgeDir } from './forge.ts';
import { relayOnce } from './relay.ts';
import { runRelayLoop } from './relay-loop.ts';
import { CANONICAL_TELEPORTER, repoRoot } from './teleporter.ts';
import { deployContracts, deployInfra, type Infra, type WorldContracts } from './world.ts';

const RELAY_INTERVAL_MS = 1000;

export const BANNER = 'SIMULATED (local-crosschain)';

export interface UpResult {
  dir: string;
  pids: number[];
  roles: WorldContracts['roles'];
  contracts: WorldContracts;
  deployed: Deployed;
  ids: Infra['ids'];
}

const answers = (rpcUrl: string): Promise<boolean> =>
  fetch(rpcUrl, { method: 'POST', signal: AbortSignal.timeout(1000) }).then(
    () => true,
    () => false,
  );

const manifest = (instance: string, infra: Infra, contracts: WorldContracts, deployed: Deployed) => ({
  version: 1,
  instance,
  chains: {
    hub: { key: LOCAL_HUB.key, chainId: LOCAL_HUB.chainId, rpcUrl: LOCAL_HUB.rpcUrl, blockchainId: infra.ids.hub },
    l1: { key: LOCAL_L1.key, chainId: LOCAL_L1.chainId, rpcUrl: LOCAL_L1.rpcUrl, blockchainId: infra.ids.l1 },
  },
  teleporter: CANONICAL_TELEPORTER,
  registries: infra.registry,
  contracts: {
    usdc: contracts.usdc,
    simulator: contracts.simulator,
    router: contracts.router,
    selector: contracts.selector.toString(),
    home: contracts.home,
    remote: contracts.remote,
    ...deployed,
  },
  roles: contracts.roles,
});

// Starts both anvils and runs steps 1 to 7; the anvils are left running, and killed here if a step fails.
export async function up(instance: string, options: { run?: ForgeRunner } = {}): Promise<UpResult> {
  assertDistinctChainIds(LOCAL_HUB, LOCAL_L1);
  for (const chain of [LOCAL_HUB, LOCAL_L1])
    if (await answers(chain.rpcUrl)) throw new Error(`a node already answers for ${chain.key}: stop it first`);
  const pids: number[] = [];
  try {
    for (const chain of [LOCAL_HUB, LOCAL_L1]) pids.push((await startLocalAnvil({ chain })).pid);
    const infra = await deployInfra(LOCAL_HUB, LOCAL_L1);
    const contracts = await deployContracts(LOCAL_HUB, LOCAL_L1, infra, instance);
    const deployed = await deployScripts(LOCAL_HUB, LOCAL_L1, contracts, options.run);
    await mintTreasury(LOCAL_HUB, contracts);
    const dir = dirname(forgeDir(repoRoot, instance));
    await writeFile(
      join(dir, 'world.json'),
      `${JSON.stringify(manifest(instance, infra, contracts, deployed), null, 2)}\n`,
    );
    await writeFile(
      join(dir, 'local.env'),
      `LOCAL_HUB_RPC_URL=${LOCAL_HUB.rpcUrl}\nLOCAL_L1_RPC_URL=${LOCAL_L1.rpcUrl}\n`,
    );
    return { dir, pids, roles: contracts.roles, contracts, deployed, ids: infra.ids };
  } catch (error) {
    for (const pid of pids) process.kill(pid, 'SIGTERM');
    throw error;
  }
}

if (import.meta.main) {
  const result = await up('dev');
  console.log(BANNER);
  console.log(`world: ${join(result.dir, 'world.json')}`);
  console.log(`env:   ${join(result.dir, 'local.env')}`);
  console.log('relay: running every second; Ctrl-C stops it and both anvils');
  const abort = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => abort.abort());
  await runRelayLoop({
    once: (cursor) => relayOnce({ hub: LOCAL_HUB, l1: LOCAL_L1 }, result.ids, cursor),
    intervalMs: RELAY_INTERVAL_MS,
    signal: abort.signal,
    log: console.log,
  });
  for (const pid of result.pids) process.kill(pid, 'SIGTERM');
  process.exit(0);
}
