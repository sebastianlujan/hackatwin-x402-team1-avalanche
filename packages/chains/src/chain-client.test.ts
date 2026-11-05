import type { Address } from '@hackatwin/core';
import { type Account, custom, encodeAbiParameters, toHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { createChainClient } from './chain-client.ts';

const token = `0x${'1'.repeat(40)}` as Address;
const abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;
const balance = { address: token, abi, functionName: 'balanceOf', args: [token] };
const transfer = { address: token, abi, functionName: 'transfer' };
const account: Account = { address: token, type: 'json-rpc' };

interface Rpc {
  readonly method: string;
  readonly params?: readonly unknown[] | undefined;
}

// A scripted JSON-RPC node that records every request.
function node(chainId: number, clientVersion = 'Geth/v1.13', head = 100n, code = '0x6001') {
  const requests: Rpc[] = [];
  const transport = custom({
    async request({ method, params }: Rpc) {
      requests.push({ method, params });
      if (method === 'eth_chainId') return toHex(chainId);
      if (method === 'eth_getCode') return code;
      if (method === 'eth_blockNumber') return toHex(head);
      if (method === 'web3_clientVersion') return clientVersion;
      if (method === 'eth_call') return encodeAbiParameters([{ type: 'uint256' }], [42n]);
      if (method === 'eth_sendTransaction') return `0x${'a'.repeat(64)}`;
      throw new Error(`unexpected ${method}`);
    },
  });
  return { transport, requests, methods: () => requests.map((r) => r.method) };
}

describe('createChainClient reads', () => {
  it('pins an explicit block and returns it', async () => {
    const rpc = node(42161);
    const client = await createChainClient({ chain: 'arbitrum', rpcUrl: 'https://rpc.test', transport: rpc.transport });
    const result = await client.read<bigint>(balance, { blockNumber: 7n });
    expect(result).toEqual({ value: 42n, blockNumber: 7n });
    const call = rpc.requests.find((r) => r.method === 'eth_call');
    expect((call?.params ?? [])[1]).toBe('0x7');
    expect(rpc.methods()).not.toContain('eth_blockNumber');
  });

  it('pins an unpinned read to the head and reports it', async () => {
    const rpc = node(42161, 'Geth', 100n);
    const client = await createChainClient({ chain: 'arbitrum', rpcUrl: 'https://rpc.test', transport: rpc.transport });
    expect(await client.read<bigint>(balance)).toEqual({ value: 42n, blockNumber: 100n });
    expect(await client.blockNumber()).toBe(100n);
    expect(client.chainId).toBe(42161);
  });

  it('rejects when the RPC reports another chain ID without echoing the URL', async () => {
    const rpc = node(1);
    const start = createChainClient({ chain: 'arbitrum', rpcUrl: 'https://secret.test/key', transport: rpc.transport });
    await expect(start).rejects.toThrow('chain "arbitrum" expects chain ID 42161 but the RPC reports 1');
    await expect(start).rejects.not.toThrow(/secret/);
  });

  it('rejects an unknown or planned chain', async () => {
    const rpc = node(1);
    await expect(
      createChainClient({ chain: 'twinpay-l1', rpcUrl: 'http://x', transport: rpc.transport }),
    ).rejects.toThrow(/twinpay-l1/);
    await expect(createChainClient({ chain: 'nope', rpcUrl: 'http://x', transport: rpc.transport })).rejects.toThrow(
      /nope/,
    );
  });
});

describe('createChainClient codeSize', () => {
  it('counts the bytes of the code and treats empty code as 0', async () => {
    const [full, empty] = [node(8453), node(8453, 'Geth', 100n, '0x')];
    const open = (rpc: ReturnType<typeof node>) =>
      createChainClient({ chain: 'base', rpcUrl: 'https://rpc.test', transport: rpc.transport });
    expect(await (await open(full)).codeSize(token, 5n)).toBe(2);
    expect(await (await open(empty)).codeSize(token)).toBe(0);
  });
});

describe('createChainClient writes', () => {
  it.each([
    ['base', 8453],
    ['arbitrum', 42161],
  ])('refuses a write on %s and sends nothing', async (chain, id) => {
    const rpc = node(id);
    const client = await createChainClient({
      chain,
      rpcUrl: 'http://127.0.0.1:8545',
      account,
      transport: rpc.transport,
    });
    await expect(client.write(transfer)).rejects.toThrow(/read-only/);
    expect(rpc.methods().filter((m) => m.startsWith('eth_send'))).toEqual([]);
  });

  it('refuses a write on a public 43114 RPC without probing it', async () => {
    const rpc = node(43114);
    const client = await createChainClient({
      chain: 'cchain',
      rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
      account,
      transport: rpc.transport,
    });
    await expect(client.write(transfer)).rejects.toThrow(/not loopback/);
    expect(rpc.methods()).toEqual(['eth_chainId']);
  });

  it('refuses a loopback 43114 RPC that is not anvil', async () => {
    const rpc = node(43114, 'Geth/v1.13');
    const client = await createChainClient({
      chain: 'cchain',
      rpcUrl: 'http://127.0.0.1:8545',
      account,
      transport: rpc.transport,
    });
    await expect(client.write(transfer)).rejects.toThrow(/does not report it/);
    expect(rpc.methods().filter((m) => m.startsWith('eth_send'))).toEqual([]);
  });

  it('allows a write on a loopback anvil and a testnet', async () => {
    const anvil = node(43114, 'anvil/v1.4.0');
    const fork = await createChainClient({
      chain: 'cchain',
      rpcUrl: 'http://127.0.0.1:8545',
      account,
      transport: anvil.transport,
    });
    expect(await fork.write(transfer)).toBe(`0x${'a'.repeat(64)}`);
    expect(anvil.methods()).toContain('eth_sendTransaction');
    const fuji = node(43113);
    const testnet = await createChainClient({
      chain: 'fuji',
      rpcUrl: 'https://rpc.test',
      account,
      transport: fuji.transport,
    });
    expect(await testnet.write(transfer)).toBe(`0x${'a'.repeat(64)}`);
  });

  it('refuses a write without an account', async () => {
    const rpc = node(43113);
    const client = await createChainClient({ chain: 'fuji', rpcUrl: 'https://rpc.test', transport: rpc.transport });
    await expect(client.write(transfer)).rejects.toThrow(/no account/);
  });
});
