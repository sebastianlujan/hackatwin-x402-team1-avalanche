import { type Address, createContainer, Ports } from '@hackatwin/core';
import { FakeChainClient } from '@hackatwin/core/testing';
import { GuardedOracle } from '@hackatwin/pricing';
import { describe, expect, it } from 'vitest';
import { registerX402Module } from './module.ts';
import { Tokens } from './tokens.ts';

const account = (n: number) => ({ address: `0x${String(n).repeat(40)}` as Address });

describe('registerX402Module', () => {
  it('registers the oracle and funding and touches no chain until it is used', () => {
    const [arbitrum, base] = [new FakeChainClient(), new FakeChainClient()];
    const container = createContainer();
    container.register(Tokens.Config, () => ({ budget: {}, forkBlock: 1n }) as never);
    container.register(
      Tokens.Accounts,
      () => ({ agent: account(1), seller: account(2), facilitator: account(3) }) as never,
    );
    container.register(Tokens.Fork, () => ({}) as never);
    container.register(Tokens.ReadChains, () => ({ arbitrum, base }));
    container.register(Tokens.State, () => ({ dir: '/mem', read: () => undefined, write: () => undefined }));
    registerX402Module(container);
    expect(container.resolve(Ports.PriceOracle)).toBeInstanceOf(GuardedOracle);
    expect(typeof container.resolve(Tokens.Funding).fund).toBe('function');
    expect([...arbitrum.calls, ...base.calls, ...arbitrum.writes, ...base.writes]).toEqual([]);
  });

  it('builds the facilitator app over the guarded fork client', async () => {
    const container = createContainer();
    container.register(Tokens.Accounts, () => ({ facilitator: account(3) }) as never);
    container.register(Tokens.Fork, () => ({ wallet: () => ({}) }) as never);
    registerX402Module(container);
    const response = await container.resolve(Tokens.FacilitatorApp).request('/supported');
    expect(await response.json()).toMatchObject({ kinds: [{ scheme: 'exact', network: 'eip155:43114' }] });
  });

  it('lets a child container override the oracle', () => {
    const container = createContainer();
    container.register(Tokens.ReadChains, () => ({ arbitrum: new FakeChainClient(), base: new FakeChainClient() }));
    registerX402Module(container);
    const fake = { quote: async () => undefined as never };
    const child = container.child();
    child.register(Ports.PriceOracle, () => fake);
    expect(child.resolve(Ports.PriceOracle)).toBe(fake);
  });
});
