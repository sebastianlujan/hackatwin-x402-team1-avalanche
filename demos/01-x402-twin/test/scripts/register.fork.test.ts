import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Erc8004Identity, SelfFeedbackError } from '@hackatwin/agent-kit';
import { chain, createGuardedClients, type GuardedClients, type LiveChain } from '@hackatwin/chains';
import { loadKeystoreAccount } from '@hackatwin/chains/keystore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type RoleIdentity, readIdentities, registerRoles } from '../../adapters/registration.ts';
import { startFork } from '../../scripts/fork.ts';
import { fileState } from '../../state.ts';

const PORT = 8546;
const dir = join(mkdtempSync(join(tmpdir(), 'register-live-')), '.demo1');
const cchain = chain('cchain') as LiveChain;
const address = (name: string) => (cchain.contracts[name] as { address: `0x${string}` }).address;
const account = (role: string) => loadKeystoreAccount(role, join(dir, `${role}.password`), dir);
let pid: number | undefined;
let fork: GuardedClients;

const adapter = (role: string) => {
  const signer = account(role);
  return new Erc8004Identity({
    chain: fork.chainClient(signer),
    identity: address('erc8004Identity'),
    reputation: address('erc8004Reputation'),
    signer: signer.address,
  });
};
const roleOf = (role: string): RoleIdentity => {
  const identity = adapter(role);
  return {
    address: account(role).address,
    register: (uri) => identity.register(uri),
    ownerOf: (id) => identity.ownerOf(id),
  };
};

beforeAll(async () => {
  const started = await startFork({ dir, port: PORT });
  pid = started.pid;
  fork = await createGuardedClients({ chain: 'cchain', rpcUrl: started.url });
  for (const role of ['agent', 'seller']) await fork.cheats().setBalance(account(role).address, 10n ** 19n);
});

afterAll(async () => {
  if (pid === undefined) return;
  process.kill(pid, 'SIGINT');
  for (let i = 0; i < 100; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
});

describe('live ERC-8004 identity', () => {
  it('registers two roles once, rates the seller and reads reputation count 1', async () => {
    const state = fileState(dir);
    const roles = { agent: roleOf('agent'), seller: roleOf('seller') };
    const first = await registerRoles(state, roles);
    expect(first.registered).toEqual(['agent', 'seller']);
    expect(first.ids.agent).not.toBe(first.ids.seller);
    expect(await adapter('seller').ownerOf(first.ids.seller)).toBe(account('seller').address);

    const blockBefore = await fork.public.getBlockNumber({ cacheTime: 0 });
    expect(await registerRoles(state, roles)).toEqual({ ids: first.ids, registered: [] });
    expect(await fork.public.getBlockNumber({ cacheTime: 0 })).toBe(blockBefore);
    expect(readIdentities(state)).toEqual(first.ids);

    const buyer = adapter('agent');
    expect((await buyer.reputation(first.ids.seller)).count).toBe(0n);
    const hash = await buyer.giveFeedback({
      agentId: first.ids.seller,
      value: 1n,
      valueDecimals: 0,
      tag1: 'x402',
      tag2: 'fx-quote',
    });
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await buyer.reputation(first.ids.seller)).toMatchObject({ count: 1n, value: 1n, valueDecimals: 0 });
  });

  it('refuses a self-feedback before sending anything', async () => {
    const state = fileState(dir);
    const { ids } = await registerRoles(state, { agent: roleOf('agent'), seller: roleOf('seller') });
    const before = await fork.public.getBlockNumber({ cacheTime: 0 });
    await expect(
      adapter('agent').giveFeedback({
        agentId: ids.agent,
        value: 1n,
        valueDecimals: 0,
        tag1: 'x402',
        tag2: 'fx-quote',
      }),
    ).rejects.toBeInstanceOf(SelfFeedbackError);
    expect(await fork.public.getBlockNumber({ cacheTime: 0 })).toBe(before);
  });
});
