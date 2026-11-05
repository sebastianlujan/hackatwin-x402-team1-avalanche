import type { LocalChain } from '@hackatwin/chains';
import { ConfigError } from '@hackatwin/config';
import { Ports } from '@hackatwin/core';
import { describe, expect, it, vi } from 'vitest';
import { logs, MESSAGE_ID } from './adapters/tracker.fixtures.ts';
import { composeRoot } from './root.ts';
import { Tokens } from './tokens.ts';
import { a, world } from './world.fixtures.ts';

const env = { LOCAL_HUB_RPC_URL: 'http://127.0.0.1:18545', LOCAL_L1_RPC_URL: 'http://127.0.0.1:18546' };

// A hub whose log query returns the router event of one sent message.
const fakeClients = (rows: unknown[] = [], refusal?: string) => {
  const executed = logs.executed();
  const raw = { ...executed, address: a(6), transactionHash: executed.txHash };
  return {
    refusal,
    public: { getLogs: vi.fn(async () => (rows.length > 0 ? [raw] : [])) },
    chainClient: vi.fn(() => ({})),
  };
};
const connect = (hub = fakeClients(), l1 = fakeClients()) =>
  vi.fn(async (chain: LocalChain) => (chain.key === 'local-hub' ? hub : l1) as never);

describe('composeRoot', () => {
  it('connects both local chains from the profile and registers World, Hub and the module', async () => {
    const hub = fakeClients();
    const connected = connect(hub);
    const { container, profile } = await composeRoot({ llm: 'scripted', env, world, connect: connected });
    expect(connected.mock.calls.map(([chain]) => [chain.key, chain.chainId, chain.rpcUrl])).toEqual([
      ['local-hub', 31337, env.LOCAL_HUB_RPC_URL],
      ['local-l1', 31338, env.LOCAL_L1_RPC_URL],
    ]);
    expect(profile.name).toBe('local-crosschain');
    expect(container.resolve(Tokens.World)).toBe(world);
    expect(container.resolve(Tokens.Hub)).toBe(hub);
    expect(container.resolve(Tokens.Router)).toBe(a(6));
    expect(container.resolve(Tokens.Lanes)).toEqual({ 31338: 99n });
  });

  it('needs no API key for the scripted LLM and names it for claude', async () => {
    await expect(composeRoot({ llm: 'scripted', env, world, connect: connect() })).resolves.toBeDefined();
    await expect(composeRoot({ llm: 'claude', env, world, connect: connect() })).rejects.toThrow(ConfigError);
    await expect(composeRoot({ llm: 'claude', env, world, connect: connect() })).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('refuses a chain whose client refuses writes', async () => {
    await expect(
      composeRoot({ llm: 'scripted', env, world, connect: connect(fakeClients([], 'not loopback')) }),
    ).rejects.toThrow('refusing to start: not loopback');
  });

  it('refuses a world whose chain IDs differ from the profile', async () => {
    const other = { ...world, chains: { ...world.chains, hub: { ...world.chains.hub, chainId: 31399 } } };
    await expect(composeRoot({ llm: 'scripted', env, world: other, connect: connect() })).rejects.toThrow('chain IDs');
  });

  it('wires a messenger whose tracker reads the hub and yields local hops without a link', async () => {
    const hub = fakeClients([1]);
    const { container } = await composeRoot({ llm: 'scripted', env, world, connect: connect(hub) });
    const messenger = container.resolve(Ports.CrossChainMessenger);
    const hops = [];
    for await (const hop of messenger.track(MESSAGE_ID)) hops.push(hop);
    expect(hops).toEqual([expect.objectContaining({ index: 0, status: 'None', transport: 'local', chainId: 31337 })]);
    expect(hops[0]).not.toHaveProperty('explorerUrl');
    expect(hub.chainClient).toHaveBeenCalledWith({ address: a(8), type: 'json-rpc' });
  });
});
