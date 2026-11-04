import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGuardedClients } from '@hackatwin/chains';
import { parseAbi } from 'viem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCAL_HUB, LOCAL_L1 } from './anvils.ts';
import { execForge, type ForgeRunner } from './forge.ts';
import { runGit } from './icm-services.ts';
import { repoRoot } from './teleporter.ts';
import { type UpResult, up } from './up.ts';

const pids: number[] = [];
const argvs: string[][] = [];
let world: UpResult;

const run: ForgeRunner = async (command, args, options) => {
  argvs.push(args);
  await execForge(command, args, options);
};
const json = (file: string) => JSON.parse(readFileSync(join(world.dir, file), 'utf8'));

const messengerAbi = parseAbi(['function RECEIVER() view returns (address)']);
const usdcAbi = parseAbi(['function balanceOf(address) view returns (uint256)']);

beforeAll(async () => {
  world = await up('deploy-test', { run });
  pids.push(...world.pids);
}, 300_000);

afterAll(() => {
  for (const pid of pids) process.kill(pid, 'SIGTERM');
});

describe('Deploy on the local world', () => {
  it('Both scripts succeed: the hub and the receiver have code and the records agree', async () => {
    const fuji = json('forge/deployments/fuji.json');
    const l1 = json('forge/deployments/twinpay-l1.json');
    const hub = await createGuardedClients({ chain: LOCAL_HUB, rpcUrl: LOCAL_HUB.rpcUrl });
    const l1c = await createGuardedClients({ chain: LOCAL_L1, rpcUrl: LOCAL_L1.rpcUrl });
    expect(fuji.chainId).toBe(31337);
    expect(l1.chainId).toBe(31338);
    for (const address of [fuji.hub, fuji.broker, fuji.messenger])
      expect(((await hub.public.getCode({ address })) ?? '0x').length).toBeGreaterThan(2);
    expect(((await l1c.public.getCode({ address: l1.receiver })) ?? '0x').length).toBeGreaterThan(2);
    expect(l1.receiver).toBe(fuji.predictedReceiver);
    const target = await hub.public.readContract({
      address: fuji.messenger,
      abi: messengerAbi,
      functionName: 'RECEIVER',
    });
    expect(target).toBe(l1.receiver);
  });

  it('Local unlocked sender: each script ran unlocked as its own deployer and no key was passed', () => {
    expect(argvs).toHaveLength(2);
    const [fuji, l1] = argvs;
    expect(fuji?.slice(-3)).toEqual(['--unlocked', '--sender', world.roles.deployer]);
    expect(l1?.slice(-3)).toEqual(['--unlocked', '--sender', world.roles.receiverDeployer]);
    expect(argvs.flat().join(' ')).not.toContain('private-key');
  });

  it('Treasury: the payer holds the minted USDC on the hub', async () => {
    const hub = await createGuardedClients({ chain: LOCAL_HUB, rpcUrl: LOCAL_HUB.rpcUrl });
    const balance = await hub.public.readContract({
      address: world.contracts.usdc,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [world.roles.treasury],
    });
    expect(balance).toBe(100_000_000n);
  });

  it('World files: world.json carries the manifest and local.env only the two RPC keys', () => {
    const manifest = json('world.json');
    expect(manifest).toMatchObject({
      version: 1,
      instance: 'deploy-test',
      chains: { hub: { chainId: 31337 }, l1: { chainId: 31338 } },
      contracts: { usdc: world.contracts.usdc, home: world.contracts.home, remote: world.contracts.remote },
    });
    expect(readFileSync(join(world.dir, 'local.env'), 'utf8')).toBe(
      `LOCAL_HUB_RPC_URL=${LOCAL_HUB.rpcUrl}\nLOCAL_L1_RPC_URL=${LOCAL_L1.rpcUrl}\n`,
    );
  });

  it('Script diff: no tracked contract, script or registry file changed', async () => {
    const status = await runGit([
      '-C',
      repoRoot,
      'status',
      '--porcelain',
      '--',
      'packages/contracts',
      'packages/chains',
    ]);
    expect(status).toBe('');
  });
});
