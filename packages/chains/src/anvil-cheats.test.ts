import type { Address } from '@hackatwin/core';
import { custom, toHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { createGuardedClients } from './guarded-clients.ts';

const who = `0x${'1'.repeat(40)}` as Address;

// A scripted JSON-RPC node that records every request.
function node(clientVersion: string, headTime = 1_000n) {
  const requests: { method: string; params?: readonly unknown[] | undefined }[] = [];
  const transport = custom({
    async request({ method, params }: { method: string; params?: readonly unknown[] | undefined }) {
      requests.push({ method, params });
      if (method === 'eth_chainId') return toHex(43114);
      if (method === 'web3_clientVersion') return clientVersion;
      if (method === 'eth_getBlockByNumber')
        return { number: '0x5', hash: `0x${'b'.repeat(64)}`, timestamp: toHex(headTime) };
      if (method === 'anvil_nodeInfo') return { forkConfig: { forkBlockNumber: 99_388_000 } };
      if (method === 'evm_snapshot') return '0x1';
      return null;
    },
  });
  return { transport, requests, methods: () => requests.map((r) => r.method) };
}

const open = async (rpcUrl: string, clientVersion: string, headTime?: bigint) => {
  const rpc = node(clientVersion, headTime);
  return { rpc, guarded: await createGuardedClients({ chain: 'cchain', rpcUrl, transport: rpc.transport }) };
};

describe('cheats refused', () => {
  it.each([
    ['a public RPC', 'https://api.avax.network/ext/bc/C/rpc', 'Geth/v1.13'],
    ['a loopback RPC that is not anvil', 'http://127.0.0.1:8545', 'Geth/v1.13'],
  ])('on %s', async (_name, url, version) => {
    const { rpc, guarded } = await open(url, version);
    expect(() => guarded.cheats()).toThrow(/anvil cheats refused/);
    expect(rpc.methods().filter((m) => /^(anvil|evm)_/.test(m))).toEqual([]);
  });
});

describe('cheats on a local anvil', () => {
  const local = 'http://127.0.0.1:8545';

  it('sends the anvil methods with encoded arguments', async () => {
    const { rpc, guarded } = await open(local, 'anvil/v1.5.1');
    const cheats = guarded.cheats();
    await cheats.impersonate(who);
    await cheats.stopImpersonating(who);
    await cheats.setBalance(who, 10n ** 19n);
    expect(await cheats.snapshot()).toBe('0x1');
    await cheats.revert('0x1');
    expect(rpc.methods()).toEqual(
      expect.arrayContaining([
        'anvil_impersonateAccount',
        'anvil_stopImpersonatingAccount',
        'evm_snapshot',
        'evm_revert',
      ]),
    );
    expect(rpc.requests.find((r) => r.method === 'anvil_setBalance')?.params).toEqual([who, toHex(10n ** 19n)]);
  });

  it('reads the fork block from anvil_nodeInfo', async () => {
    const { guarded } = await open(local, 'anvil/v1.5.1');
    expect(await guarded.cheats().forkBlock()).toBe(99_388_000n);
  });

  it('mines a block at the wall time only when the head is more than 30 s behind', async () => {
    const stale = await open(local, 'anvil/v1.5.1', 1_000n);
    await stale.guarded.cheats().syncClock(2_000n);
    expect(stale.rpc.methods()).toEqual(expect.arrayContaining(['evm_setNextBlockTimestamp', 'anvil_mine']));
    const fresh = await open(local, 'anvil/v1.5.1', 1_990n);
    expect(await fresh.guarded.cheats().syncClock(2_000n)).toBe(1_990n);
    expect(fresh.rpc.methods().filter((m) => /^(anvil|evm)_/.test(m))).toEqual([]);
  });
});
