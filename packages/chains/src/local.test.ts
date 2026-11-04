import { describe, expect, it } from 'vitest';
import { ChainError } from './chain-error.ts';
import { assertLocalChain, isLocalChainKey, type LocalChain, localChain, toViemLocalChain } from './local.ts';
import { chain, listChains } from './registry.ts';

const hub = { chainId: 31337, rpcUrl: 'http://127.0.0.1:8545' };

describe('localChain', () => {
  it('builds a plain fork-only chain from a loopback URL and a safe chain ID', () => {
    expect(localChain('local-hub', hub)).toEqual({ key: 'local-hub', access: 'fork-only', mode: 'plain', ...hub });
    expect(localChain('local-l1', { chainId: 31338, rpcUrl: 'http://localhost:8546' })).toMatchObject({
      key: 'local-l1',
      chainId: 31338,
    });
  });

  it.each([43113, 43114, 11155111, 42161, 8453])('refuses the live chain ID %i', (chainId) => {
    expect(() => localChain('local-hub', { ...hub, chainId })).toThrow(new RegExp(`chain ID ${chainId}`));
  });

  it.each([0, -1, 1.5])('refuses the invalid chain ID %s', (chainId) => {
    expect(() => localChain('local-hub', { ...hub, chainId })).toThrow(/chain ID/);
  });

  it.each(['https://api.avax-test.network/ext/bc/C/rpc', 'http://10.0.0.5:8545', 'not a url'])(
    'refuses the non-loopback URL %s without echoing it',
    (rpcUrl) => {
      const make = () => localChain('local-hub', { ...hub, rpcUrl });
      expect(make).toThrow(ChainError);
      expect(make).toThrow(/not loopback/);
      expect(make).not.toThrow(/avax-test|10\.0\.0\.5/);
    },
  );

  it('recognizes only the two local keys', () => {
    expect(['local-hub', 'local-l1', 'fuji', 'local-x'].map(isLocalChainKey)).toEqual([true, true, false, false]);
  });
});

describe('assertLocalChain', () => {
  it('refuses a hand-built object that skipped the factory', () => {
    const forged = { key: 'local-hub', access: 'fork-only', mode: 'plain', chainId: 43113, rpcUrl: hub.rpcUrl };
    expect(() => assertLocalChain(forged as LocalChain)).toThrow(/chain ID 43113/);
    expect(() =>
      assertLocalChain({ ...forged, chainId: 31337, rpcUrl: 'https://rpc.test:8545' } as LocalChain),
    ).toThrow(/not loopback/);
    expect(() => assertLocalChain(localChain('local-hub', hub))).not.toThrow();
  });
});

describe('local chain definitions', () => {
  it('has no explorer and carries the chain ID and RPC', () => {
    const viem = toViemLocalChain(localChain('local-hub', hub));
    expect(viem.blockExplorers).toBeUndefined();
    expect(viem.id).toBe(31337);
    expect(viem.rpcUrls.default.http).toEqual([hub.rpcUrl]);
  });

  it('leaves the six-chain registry unchanged', () => {
    localChain('local-hub', hub);
    expect(listChains().map((c) => c.key)).toEqual(['cchain', 'fuji', 'sepolia', 'twinpay-l1', 'arbitrum', 'base']);
    expect(() => chain('local-hub')).toThrow(/unknown chain "local-hub"/);
  });
});
