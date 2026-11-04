import { describe, expect, it } from 'vitest';
import { isLoopback, needsClientVersion, writeRefusal } from './write-guard.ts';

const remote = 'https://api.avax.network/ext/bc/C/rpc';
const local = 'http://127.0.0.1:8545';

describe('writeRefusal', () => {
  it.each([
    [42161, 'read-only'],
    [8453, 'read-only'],
    [8453, 'read-write'],
  ] as const)('never writes on chain %i (%s)', (chainId, access) => {
    expect(writeRefusal({ chainId, access, rpcUrl: local, clientVersion: 'anvil/v1' })).toMatch(/read-only/);
  });

  it('refuses a public RPC on 43114', () => {
    expect(writeRefusal({ chainId: 43114, access: 'fork-only', rpcUrl: remote })).toMatch(/not loopback/);
  });

  it('refuses a loopback RPC that does not report anvil', () => {
    const target = { chainId: 43114, access: 'fork-only', rpcUrl: local } as const;
    expect(writeRefusal({ ...target, clientVersion: 'Geth/v1.13' })).toMatch(/does not report it/);
    expect(writeRefusal(target)).toMatch(/does not report it/);
  });

  it('allows a loopback anvil on 43114 and any testnet', () => {
    const fork = { chainId: 43114, access: 'fork-only', rpcUrl: local, clientVersion: 'anvil/v1.4.0' } as const;
    expect(writeRefusal(fork)).toBeUndefined();
    expect(writeRefusal({ chainId: 43113, access: 'read-write', rpcUrl: remote })).toBeUndefined();
  });
});

describe('probes', () => {
  it.each([local, 'http://localhost:8545', 'ws://[::1]:8545'])('treats %s as loopback', (url) => {
    expect(isLoopback(url)).toBe(true);
  });

  it('rejects remote and invalid URLs, and probes only a loopback 43114', () => {
    expect([isLoopback(remote), isLoopback('not a url')]).toEqual([false, false]);
    expect(needsClientVersion(43114, local)).toBe(true);
    expect([needsClientVersion(43114, remote), needsClientVersion(43113, local)]).toEqual([false, false]);
  });
});
