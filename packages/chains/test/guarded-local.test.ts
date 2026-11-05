import type { Address } from '@hackatwin/core';
import { custom, toHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { createGuardedClients } from '../src/guarded-clients.ts';
import { localChain } from '../src/local.ts';

const LOCAL = 'http://127.0.0.1:8545';
const who = `0x${'1'.repeat(40)}` as Address;
const hub = localChain('local-hub', { chainId: 31337, rpcUrl: LOCAL });

// A scripted JSON-RPC node that records every request.
function node(chainId: number, clientVersion = 'anvil/v1.5.1') {
  const requests: { method: string; params?: readonly unknown[] | undefined }[] = [];
  const transport = custom({
    async request({ method, params }: { method: string; params?: readonly unknown[] | undefined }) {
      requests.push({ method, params });
      if (method === 'eth_chainId') return toHex(chainId);
      if (method === 'web3_clientVersion') return clientVersion;
      if (method === 'eth_sendTransaction') return `0x${'ab'.repeat(32)}`;
      return null;
    },
  });
  return { transport, requests, methods: () => requests.map((r) => r.method) };
}

describe('guarded clients on a local chain', () => {
  it('allows writes and cheats on a loopback anvil with the configured chain ID', async () => {
    const rpc = node(31337);
    const guarded = await createGuardedClients({ chain: hub, rpcUrl: LOCAL, transport: rpc.transport });
    expect(guarded.refusal).toBeUndefined();
    expect(guarded.chainId).toBe(31337);
    await guarded.cheats().setBalance(who, 5n);
    expect(rpc.methods()).toContain('anvil_setBalance');
  });

  it('passes the call value to the wallet write', async () => {
    const rpc = node(31337);
    const guarded = await createGuardedClients({ chain: hub, rpcUrl: LOCAL, transport: rpc.transport });
    const account = { address: who, type: 'json-rpc' } as const;
    const abi = [{ type: 'function', name: 'f', stateMutability: 'payable', inputs: [], outputs: [] }] as const;
    await guarded.chainClient(account).write({ address: who, abi, functionName: 'f', value: 7n });
    const sent = rpc.requests.find((r) => r.method === 'eth_sendTransaction')?.params?.[0] as { value?: string };
    expect(sent.value).toBe('0x7');
  });

  it('installs code with anvil_setCode', async () => {
    const rpc = node(31337);
    const guarded = await createGuardedClients({ chain: hub, rpcUrl: LOCAL, transport: rpc.transport });
    await guarded.cheats().setCode(who, '0x6001');
    expect(rpc.requests.find((r) => r.method === 'anvil_setCode')?.params).toEqual([who, '0x6001']);
  });

  it('refuses a loopback RPC that reports 43113 and sends no write', async () => {
    const rpc = node(43113);
    const start = createGuardedClients({ chain: hub, rpcUrl: LOCAL, transport: rpc.transport });
    await expect(start).rejects.toThrow('chain "local-hub" expects chain ID 31337 but the RPC reports 43113');
    expect(rpc.methods().filter((m) => /^(eth_send|anvil_|evm_)/.test(m))).toEqual([]);
  });

  it('refuses a non-loopback host, names the host and makes no call', async () => {
    const rpc = node(31337);
    const start = createGuardedClients({
      chain: hub,
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc?key=secret',
      transport: rpc.transport,
    });
    await expect(start).rejects.toThrow(/api\.avax-test\.network/);
    await expect(start).rejects.not.toThrow(/secret/);
    expect(rpc.methods()).toEqual([]);
  });

  it('refuses writes when the loopback RPC is not anvil', async () => {
    const rpc = node(31337, 'Geth/v1.13');
    const guarded = await createGuardedClients({ chain: hub, rpcUrl: LOCAL, transport: rpc.transport });
    expect(guarded.refusal).toMatch(/does not report it/);
    expect(() => guarded.cheats()).toThrow(/anvil cheats refused/);
  });
});
