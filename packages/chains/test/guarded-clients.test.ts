import type { Address } from '@hackatwin/core';
import { custom, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { createGuardedClients } from '../src/guarded-clients.ts';

const PUBLIC = 'https://api.avax.network/ext/bc/C/rpc';
const LOCAL = 'http://127.0.0.1:8545';
const who = `0x${'1'.repeat(40)}` as Address;
const signer = privateKeyToAccount(generatePrivateKey());
const typed = {
  domain: { name: 'Permit2', chainId: 43114 },
  types: { Msg: [{ name: 'value', type: 'uint256' }] },
  primaryType: 'Msg',
  message: { value: 1n },
} as const;
const refused = /refused/;

// A scripted JSON-RPC node that records every request.
function node(clientVersion: string, chainId = 43114) {
  const methods: string[] = [];
  const transport = custom({
    async request({ method }: { method: string }) {
      methods.push(method);
      if (method === 'eth_chainId') return toHex(chainId);
      if (method === 'web3_clientVersion') return clientVersion;
      if (method === 'eth_getCode') return '0x6001';
      if (method === 'eth_blockNumber') return toHex(5);
      return null;
    },
  });
  return { transport, methods, writes: () => methods.filter((m) => /^(eth_send|anvil_|evm_)/.test(m)) };
}

const open = async (rpcUrl: string, clientVersion: string) => {
  const rpc = node(clientVersion);
  return { rpc, guarded: await createGuardedClients({ chain: 'cchain', rpcUrl, transport: rpc.transport }) };
};
const raw = (method: string) => ({ method: method as never, params: [] as never });

describe('SDK signer on a public RPC', () => {
  it('refuses to sign and calls no write method', async () => {
    const { rpc, guarded } = await open(PUBLIC, 'Geth/v1.13');
    expect(guarded.refusal).toMatch(/not loopback/);
    const wallet = guarded.wallet(signer);
    await expect(wallet.signTypedData(typed)).rejects.toThrow(/signing refused/);
    await expect(wallet.signMessage({ message: 'hi' })).rejects.toThrow(/signing refused/);
    await expect(wallet.sendTransaction({ to: who, value: 1n })).rejects.toThrow();
    expect(rpc.writes()).toEqual([]);
    expect(rpc.methods).not.toContain('web3_clientVersion');
  });

  it('refuses a raw write, a cheat and any method outside the read allowlist', async () => {
    const { rpc, guarded } = await open(PUBLIC, 'Geth/v1.13');
    for (const method of ['eth_sendRawTransaction', 'anvil_setBalance', 'eth_newFilter']) {
      await expect(guarded.public.request(raw(method))).rejects.toThrow(refused);
    }
    expect(rpc.methods).toEqual(['eth_chainId']);
  });

  it('never serves a cached head, so a read after a write sees the new block', async () => {
    const { rpc, guarded } = await open(PUBLIC, 'Geth/v1.13');
    const client = guarded.chainClient();
    await client.blockNumber();
    await client.blockNumber();
    expect(rpc.methods.filter((method) => method === 'eth_blockNumber')).toHaveLength(2);
  });

  it('keeps reads working', async () => {
    const { guarded } = await open(PUBLIC, 'Geth/v1.13');
    expect(await guarded.public.getCode({ address: who })).toBe('0x6001');
    expect(await guarded.chainClient().blockNumber()).toBe(5n);
  });
});

describe('loopback RPC that is not anvil', () => {
  it('refuses writes, signing and cheat methods', async () => {
    const { rpc, guarded } = await open(LOCAL, 'Geth/v1.13');
    expect(guarded.refusal).toMatch(/does not report it/);
    await expect(guarded.wallet(signer).signTypedData(typed)).rejects.toThrow(/signing refused/);
    await expect(guarded.public.request(raw('anvil_mine'))).rejects.toThrow(refused);
    const write = guarded.chainClient(signer).write({ address: who, abi: [], functionName: 'f' });
    await expect(write).rejects.toThrow(/write refused/);
    expect(rpc.writes()).toEqual([]);
  });
});

describe('local anvil', () => {
  it('lets a local account sign, passes cheat methods and probes the version once', async () => {
    const { rpc, guarded } = await open(LOCAL, 'anvil/v1.5.1');
    expect(guarded.refusal).toBeUndefined();
    expect(await guarded.wallet(signer).signTypedData(typed)).toMatch(/^0x[0-9a-f]+$/);
    await guarded.public.request(raw('anvil_mine'));
    expect(rpc.methods).toContain('anvil_mine');
    expect(rpc.methods.filter((m) => m === 'web3_clientVersion')).toHaveLength(1);
  });
});

describe('probe', () => {
  it('rejects a chain ID mismatch without echoing the URL', async () => {
    const rpcUrl = 'https://secret.test/key';
    const start = createGuardedClients({ chain: 'base', rpcUrl, transport: node('Geth').transport });
    await expect(start).rejects.toThrow('chain "base" expects chain ID 8453 but the RPC reports 43114');
    await expect(start).rejects.not.toThrow(/secret/);
  });
});
