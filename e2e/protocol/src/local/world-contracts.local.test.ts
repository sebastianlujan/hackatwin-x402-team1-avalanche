import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGuardedClients, startLocalAnvil } from '@hackatwin/chains';
import { parseAbi } from 'viem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCAL_HUB, LOCAL_L1 } from './anvils.ts';
import { forgeDir } from './forge.ts';
import { runGit } from './icm-services.ts';
import { repoRoot } from './teleporter.ts';
import { deployContracts, deployInfra, type WorldContracts } from './world.ts';

const pids: number[] = [];
let world: WorldContracts;
let infraIds: { hub: `0x${string}`; l1: `0x${string}` };

const homeAbi = parseAbi([
  'function getRemoteTokenTransferrerSettings(bytes32 remoteBlockchainID, address remote) view returns ((bool registered, uint256 collateralNeeded, uint256 tokenMultiplier, bool multiplyOnRemote))',
]);
const erc20Abi = parseAbi(['function decimals() view returns (uint8)', 'function symbol() view returns (string)']);
const simulatorAbi = parseAbi([
  'function configuration() view returns (uint64 chainSelector_, address sourceRouter_, address destinationRouter_, address wrappedNative_, address linkToken_, address ccipBnM_, address ccipLnM_)',
]);

beforeAll(async () => {
  for (const chain of [LOCAL_HUB, LOCAL_L1]) pids.push((await startLocalAnvil({ chain })).pid);
  const infra = await deployInfra(LOCAL_HUB, LOCAL_L1);
  infraIds = infra.ids;
  world = await deployContracts(LOCAL_HUB, LOCAL_L1, infra, 'world-test');
});

afterAll(() => {
  for (const pid of pids) process.kill(pid, 'SIGTERM');
});

describe('World contracts', () => {
  it('Remote registered: the home lists the remote after the relayed registerWithHome', async () => {
    const hub = await createGuardedClients({ chain: LOCAL_HUB, rpcUrl: LOCAL_HUB.rpcUrl });
    const settings = await hub.public.readContract({
      address: world.home,
      abi: homeAbi,
      functionName: 'getRemoteTokenTransferrerSettings',
      args: [infraIds.l1, world.remote],
    });
    expect(settings.registered).toBe(true);
  });

  it('LocalUsdc has 6 decimals and the remote mirrors it', async () => {
    const hub = await createGuardedClients({ chain: LOCAL_HUB, rpcUrl: LOCAL_HUB.rpcUrl });
    const l1 = await createGuardedClients({ chain: LOCAL_L1, rpcUrl: LOCAL_L1.rpcUrl });
    expect(await hub.public.readContract({ address: world.usdc, abi: erc20Abi, functionName: 'decimals' })).toBe(6);
    expect(await l1.public.readContract({ address: world.remote, abi: erc20Abi, functionName: 'decimals' })).toBe(6);
  });

  it('Source key: the local registry names local-ccip with the selector the simulator reports', async () => {
    const hub = await createGuardedClients({ chain: LOCAL_HUB, rpcUrl: LOCAL_HUB.rpcUrl });
    const [selector, router] = await hub.public.readContract({
      address: world.simulator,
      abi: simulatorAbi,
      functionName: 'configuration',
    });
    const dir = forgeDir(repoRoot, 'world-test');
    const source = JSON.parse(readFileSync(join(dir, 'registry/local-ccip.json'), 'utf8'));
    expect(source).toMatchObject({ key: 'local-ccip', ccip: { chainSelector: selector.toString() } });
    const fuji = JSON.parse(readFileSync(join(dir, 'registry/fuji.json'), 'utf8'));
    expect(fuji.contracts.ccipRouter.address).toBe(router);
  });

  it('Registry untouched: no tracked registry or fixture file changed', async () => {
    const status = await runGit([
      '-C',
      repoRoot,
      'status',
      '--porcelain',
      '--',
      'packages/chains',
      'packages/contracts/test/fixtures',
    ]);
    expect(status).toBe('');
  });
});
