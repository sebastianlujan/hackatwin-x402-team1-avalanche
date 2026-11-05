import type { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { anvilArgs, plainAnvilArgs, startAnvil, startLocalAnvil } from '../src/anvil.ts';
import { type LocalChain, localChain } from '../src/local.ts';

const upstream = 'https://api.avax.network/ext/bc/C/rpc';

describe('anvilArgs', () => {
  it('pins the chain, hardfork, block and a fixed loopback host', () => {
    expect(anvilArgs({ upstream, forkBlock: 99_388_000n, port: 8546 })).toEqual([
      '--fork-url',
      upstream,
      '--fork-block-number',
      '99388000',
      '--chain-id',
      '43114',
      '--hardfork',
      'cancun',
      '--host',
      '127.0.0.1',
      '--port',
      '8546',
    ]);
    expect(anvilArgs({ upstream, forkBlock: 1n })).toContain('8545');
  });

  it.each(['ftp://host/rpc', 'ws://host/rpc', 'not a url', '--fork-block-number 1'])('rejects upstream %s', (bad) => {
    expect(() => anvilArgs({ upstream: bad, forkBlock: 1n })).toThrow('anvil upstream must be an http(s) URL');
  });

  it.each([0, 80, 1023, 65536, 1.5, Number.NaN])('rejects port %s', (port) => {
    expect(() => anvilArgs({ upstream, forkBlock: 1n, port })).toThrow(/out of range/);
  });

  it('rejects a non-positive fork block and never echoes the upstream', () => {
    expect(() => anvilArgs({ upstream, forkBlock: 0n })).toThrow(/positive/);
    expect(() => anvilArgs({ upstream: 'ftp://secret-host/key', forkBlock: 1n })).not.toThrow(/secret/);
  });

  it('keeps a URL with spaces as one argv element', () => {
    const url = 'https://rpc.test/a b;rm -rf';
    const args = anvilArgs({ upstream: url, forkBlock: 1n });
    expect(args[args.indexOf('--fork-url') + 1]).toBe(url);
    expect(args).toHaveLength(12);
  });
});

describe('startAnvil', () => {
  const fake = (calls: unknown[][]): typeof spawn =>
    ((...call: unknown[]) => {
      calls.push(call);
      const child = new EventEmitter() as ChildProcess;
      Object.assign(child, {
        pid: 4242,
        unref: () => undefined,
        kill: () => ((child as { killed: boolean }).killed = true),
      });
      return child;
    }) as never;

  it('spawns anvil without a shell and kills it when it is not ready in time', async () => {
    const calls: unknown[][] = [];
    const run = startAnvil({ upstream, forkBlock: 1n, port: 8599, readyTimeoutMs: 300, spawn: fake(calls) });
    await expect(run).rejects.toThrow(/not ready before the timeout/);
    const [file, args, options] = calls[0] as [string, string[], { shell: boolean; detached: boolean }];
    expect(file).toBe('anvil');
    expect(args).toEqual(anvilArgs({ upstream, forkBlock: 1n, port: 8599 }));
    expect(options).toMatchObject({ shell: false, detached: true });
  });
});

describe('plainAnvilArgs', () => {
  const local = localChain('local-hub', { chainId: 31337, rpcUrl: 'http://127.0.0.1:8546' });

  it('passes the chain ID, hardfork and loopback host and never a fork URL', () => {
    expect(plainAnvilArgs(local)).toEqual([
      ...['--chain-id', '31337', '--hardfork', 'cancun', '--host', '127.0.0.1', '--port', '8546'],
    ]);
    expect(plainAnvilArgs(local)).not.toContain('--fork-url');
  });

  it('follows the port of the chain URL and refuses a URL with no explicit port', () => {
    const other = localChain('local-l1', { chainId: 31338, rpcUrl: 'http://localhost:9000' });
    expect(plainAnvilArgs(other)).toEqual(expect.arrayContaining(['31338', '9000']));
    const noPort = localChain('local-l1', { chainId: 31338, rpcUrl: 'http://localhost' });
    expect(() => plainAnvilArgs(noPort)).toThrow(/explicit port/);
  });
});

describe('startLocalAnvil', () => {
  const fake = (calls: unknown[][]): typeof spawn =>
    ((...call: unknown[]) => {
      calls.push(call);
      const child = new EventEmitter() as ChildProcess;
      Object.assign(child, { pid: 4243, unref: () => undefined, kill: () => undefined });
      return child;
    }) as never;

  it('spawns plain anvil without a shell and kills it when it is not ready in time', async () => {
    const calls: unknown[][] = [];
    const chain = localChain('local-hub', { chainId: 31337, rpcUrl: 'http://127.0.0.1:8598' });
    await expect(startLocalAnvil({ chain, readyTimeoutMs: 300, spawn: fake(calls) })).rejects.toThrow(/not ready/);
    const [file, args, options] = calls[0] as [string, string[], { shell: boolean; detached: boolean }];
    expect(file).toBe('anvil');
    expect(args).toEqual(plainAnvilArgs(chain));
    expect(options).toMatchObject({ shell: false, detached: true });
  });

  it('refuses a forbidden chain ID before it spawns', async () => {
    const calls: unknown[][] = [];
    const chain = {
      key: 'local-hub',
      access: 'fork-only',
      mode: 'plain',
      chainId: 43113,
      rpcUrl: 'http://127.0.0.1:8599',
    };
    await expect(startLocalAnvil({ chain: chain as LocalChain, spawn: fake(calls) })).rejects.toThrow(/chain ID 43113/);
    expect(calls).toEqual([]);
  });

  it('refuses a non-loopback URL before it spawns', async () => {
    const calls: unknown[][] = [];
    const chain = {
      key: 'local-l1',
      access: 'fork-only',
      mode: 'plain',
      chainId: 31338,
      rpcUrl: 'https://rpc.test:8545',
    };
    await expect(startLocalAnvil({ chain: chain as LocalChain, spawn: fake(calls) })).rejects.toThrow(/not loopback/);
    expect(calls).toEqual([]);
  });
});
