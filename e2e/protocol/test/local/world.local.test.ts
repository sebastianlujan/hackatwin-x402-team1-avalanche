import { createGuardedClients, startLocalAnvil } from '@hackatwin/chains';
import { keccak256, parseAbi, toHex } from 'viem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCAL_HUB, LOCAL_L1 } from '../../src/local/anvils.ts';
import { CANONICAL_TELEPORTER } from '../../src/local/teleporter.ts';
import { deployInfra, type Infra, WARP } from '../../src/local/world.ts';

const pids: number[] = [];
let infra: Infra;

const warpAbi = parseAbi(['function getBlockchainID() view returns (bytes32)']);
const registryAbi = parseAbi([
  'function latestVersion() view returns (uint256)',
  'function getAddressFromVersion(uint256 version) view returns (address)',
]);

beforeAll(async () => {
  for (const chain of [LOCAL_HUB, LOCAL_L1]) pids.push((await startLocalAnvil({ chain })).pid);
  infra = await deployInfra(LOCAL_HUB, LOCAL_L1);
});

afterAll(() => {
  for (const pid of pids) process.kill(pid, 'SIGTERM');
});

const chains = [
  ['hub', LOCAL_HUB],
  ['l1', LOCAL_L1],
] as const;

describe.each(chains)('World infra on the %s', (side, chain) => {
  const client = () => createGuardedClients({ chain, rpcUrl: chain.rpcUrl });

  it('puts the Warp stub at the Warp address with the chain blockchain ID', async () => {
    const c = await client();
    expect(((await c.public.getCode({ address: WARP })) ?? '0x').length).toBeGreaterThan(2);
    const id = await c.public.readContract({ address: WARP, abi: warpAbi, functionName: 'getBlockchainID' });
    expect(id).toBe(keccak256(toHex(`local-${side}`)));
    expect(infra.ids[side]).toBe(id);
  });

  it('puts Teleporter at the canonical address', async () => {
    const c = await client();
    expect(CANONICAL_TELEPORTER).toBe('0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf');
    expect(((await c.public.getCode({ address: CANONICAL_TELEPORTER })) ?? '0x').length).toBeGreaterThan(2);
  });

  it('deploys a TeleporterRegistry that lists Teleporter as version 1', async () => {
    const c = await client();
    const address = infra.registry[side];
    const [latest, listed] = await Promise.all([
      c.public.readContract({ address, abi: registryAbi, functionName: 'latestVersion' }),
      c.public.readContract({ address, abi: registryAbi, functionName: 'getAddressFromVersion', args: [1n] }),
    ]);
    expect(latest).toBe(1n);
    expect(listed).toBe(CANONICAL_TELEPORTER);
  });
});
