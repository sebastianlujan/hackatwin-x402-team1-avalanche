import { BudgetPolicy } from '@hackatwin/agent-kit';
import { type Address, createContainer, money, Ports } from '@hackatwin/core';
import { FakeChainClient } from '@hackatwin/core/testing';
import { GuardedOracle } from '@hackatwin/pricing';
import { describe, expect, it } from 'vitest';
import { registerX402Module } from '../module.ts';
import { Tokens } from '../tokens.ts';

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

  it('builds the seller app over the oracle and the facilitator URL without touching the network', () => {
    const container = createContainer();
    container.register(Tokens.Accounts, () => ({ seller: account(2) }) as never);
    container.register(Tokens.ReadChains, () => ({ arbitrum: new FakeChainClient(), base: new FakeChainClient() }));
    registerX402Module(container);
    expect(typeof container.resolve(Tokens.SellerApp).request).toBe('function');
  });

  it('builds the registration service over the guarded fork client without sending anything', () => {
    const container = createContainer();
    const wrote: unknown[] = [];
    container.register(Tokens.Accounts, () => ({ agent: account(1), seller: account(2) }) as never);
    container.register(
      Tokens.Fork,
      () => ({ chainClient: () => ({ write: (call: unknown) => wrote.push(call) }) }) as never,
    );
    container.register(Tokens.State, () => ({ dir: '/mem', read: () => undefined, write: () => undefined }));
    registerX402Module(container);
    expect(typeof container.resolve(Tokens.Registration).register).toBe('function');
    expect(wrote).toEqual([]);
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

  it('builds the buyer, the policy and the balances reader without touching the chain', async () => {
    const container = createContainer();
    const sent: unknown[] = [];
    const agent = { address: account(1).address, type: 'local', signTypedData: async () => '0x' };
    container.register(
      Tokens.Config,
      () => ({ budget: { perPayment: money(1_000_000n, 6, 'USD'), total: money(5_000_000n, 6, 'USD') } }) as never,
    );
    container.register(Tokens.Accounts, () => ({ agent, seller: account(2), facilitator: account(3) }) as never);
    container.register(
      Tokens.Fork,
      () =>
        ({
          public: { readContract: async () => 0n },
          wallet: () => ({ account: agent }),
          chainClient: () => ({ read: (c: unknown) => sent.push(c) }),
        }) as never,
    );
    container.register(Tokens.ReadChains, () => ({ arbitrum: new FakeChainClient(), base: new FakeChainClient() }));
    container.register(Tokens.Events, () => () => undefined);
    container.register(Tokens.State, () => ({
      dir: '/mem',
      read: () => ({ agent: '1', seller: '2' }) as never,
      write: () => undefined,
    }));
    registerX402Module(container);
    expect(container.resolve(Tokens.Buyer).tools.map((tool) => tool.name)).toEqual(['quote', 'buy', 'rate_seller']);
    expect(container.resolve(Ports.AgentPolicy)).toBeInstanceOf(BudgetPolicy);
    expect(typeof container.resolve(Tokens.Balances).read).toBe('function');
    expect(sent).toEqual([]);
  });

  it('fails the buyer with the fix when the seller is not registered', () => {
    const container = createContainer();
    container.register(
      Tokens.Config,
      () => ({ budget: { perPayment: money(1n, 6, 'USD'), total: money(2n, 6, 'USD') } }) as never,
    );
    container.register(Tokens.Accounts, () => ({ agent: account(1) }) as never);
    container.register(Tokens.Fork, () => ({}) as never);
    container.register(Tokens.Events, () => () => undefined);
    container.register(Tokens.State, () => ({ dir: '/mem', read: () => undefined, write: () => undefined }));
    registerX402Module(container);
    expect(() => container.resolve(Tokens.Buyer)).toThrow('pnpm demo1:register');
  });
});
