import { type Address, createContainer, type Hex } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { parseWorld } from '../deployment.ts';
import { registerCrossChainModule } from '../module.ts';
import { Tokens } from '../tokens.ts';

const a = (n: number) => `0x${n.toString(16).repeat(40)}` as Address;
const world = parseWorld({
  version: 1,
  instance: 'dev',
  chains: {
    hub: { key: 'local-hub', chainId: 31337, rpcUrl: 'http://127.0.0.1:18545', blockchainId: `0x${'1'.repeat(64)}` },
    l1: { key: 'local-l1', chainId: 31338, rpcUrl: 'http://127.0.0.1:18546', blockchainId: `0x${'2'.repeat(64)}` },
  },
  contracts: {
    usdc: a(1),
    hub: a(2),
    broker: a(3),
    messenger: a(4),
    receiver: a(5),
    router: a(6),
    home: a(10),
    remote: a(11),
    selector: '99',
  },
  roles: { treasury: a(7), agent: a(8), merchant: a(9) },
});

describe('registerCrossChainModule', () => {
  it('registers the tokens and resolves none of them', () => {
    const container = createContainer();
    const resolve = vi.spyOn(container, 'resolve');
    registerCrossChainModule(container);
    expect(resolve).not.toHaveBeenCalled();
    container.register(Tokens.World, () => world);
    expect(container.resolve(Tokens.Router)).toBe(a(6));
    expect(container.resolve(Tokens.Lanes)).toEqual({ 31338: 99n });
  });

  it('funds an L1 address from the treasury through the home and the remote', async () => {
    const container = createContainer();
    const client = new FakeChainClient({ reads: { [readKey(a(1), 'allowance', [a(7), a(10)])]: 0n } });
    const accounts: unknown[] = [];
    container.register(Tokens.World, () => world);
    const chainClient = (account: unknown) => {
      accounts.push(account);
      return client;
    };
    container.register(Tokens.Hub, () => ({ chainClient }) as never);
    registerCrossChainModule(container);
    const funding = container.resolve(Tokens.Funding);
    expect(client.writes).toEqual([]);
    const hash: Hex = await funding.fund(a(12), 4_000_000n);
    expect(accounts).toEqual([{ address: a(7), type: 'json-rpc' }]);
    expect(client.writes.map((w) => [w.address, w.functionName])).toEqual([
      [a(1), 'approve'],
      [a(10), 'send'],
    ]);
    expect(client.writes[1]?.args).toMatchObject([
      { recipient: a(12), destinationTokenTransferrerAddress: a(11) },
      4_000_000n,
    ]);
    expect(hash).toBe(`0x${'2'.padStart(64, '0')}`);
  });
});
