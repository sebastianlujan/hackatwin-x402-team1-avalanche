import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { localChain } from '@hackatwin/chains';
import { afterEach, describe, expect, it } from 'vitest';
import { assertDistinctChainIds, LOCAL_HUB, LOCAL_L1, probeChainId } from './anvils.ts';

const servers: Server[] = [];
const rpcStub = async (chainId: number): Promise<string> => {
  const server = createServer((_, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: `0x${chainId.toString(16)}` }));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe('local anvil constants', () => {
  it('use chain IDs 31337 and 31338 on loopback', () => {
    expect([LOCAL_HUB.chainId, LOCAL_L1.chainId]).toEqual([31337, 31338]);
    expect(LOCAL_HUB.rpcUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(LOCAL_L1.rpcUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });
});

describe('probeChainId', () => {
  it('returns the chain ID the node reports', async () => {
    const chain = localChain('local-hub', { chainId: 31337, rpcUrl: await rpcStub(31337) });
    expect(await probeChainId(chain)).toBe(31337);
  });

  it('refuses a node that reports a different chain ID', async () => {
    const chain = localChain('local-hub', { chainId: 31337, rpcUrl: await rpcStub(43113) });
    await expect(probeChainId(chain)).rejects.toThrow(/43113/);
  });

  it('refuses a non-loopback RPC before any request', async () => {
    const remote = { ...LOCAL_HUB, rpcUrl: 'https://example.com:8545' };
    await expect(probeChainId(remote)).rejects.toThrow(/loopback/);
  });
});

describe('assertDistinctChainIds', () => {
  it('accepts two different IDs', () => {
    expect(() => assertDistinctChainIds(LOCAL_HUB, LOCAL_L1)).not.toThrow();
  });

  it('refuses equal IDs', () => {
    expect(() => assertDistinctChainIds(LOCAL_HUB, LOCAL_HUB)).toThrow(/distinct/);
  });
});
