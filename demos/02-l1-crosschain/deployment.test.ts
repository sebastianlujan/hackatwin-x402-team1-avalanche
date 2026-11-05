import { describe, expect, it } from 'vitest';
import { parseWorld } from './deployment.ts';

const a = (n: number) => `0x${n.toString(16).repeat(40)}`;
const chain = (key: string, chainId: number, port: number, id: string) => ({
  key,
  chainId,
  rpcUrl: `http://127.0.0.1:${port}`,
  blockchainId: `0x${id.repeat(64)}`,
});
const manifest = () => ({
  version: 1,
  instance: 'dev',
  chains: { hub: chain('local-hub', 31337, 18545, '1'), l1: chain('local-l1', 31338, 18546, '2') },
  contracts: { usdc: a(1), hub: a(2), broker: a(3), messenger: a(4), receiver: a(5), router: a(6), selector: '99' },
  roles: { treasury: a(7), agent: a(8), merchant: a(9) },
});

describe('World manifest', () => {
  it('reads the fields the setup needs', () => {
    const world = parseWorld(manifest());
    expect(world.chains.hub.chainId).toBe(31337);
    expect(world.chains.l1.blockchainId).toBe(`0x${'2'.repeat(64)}`);
    expect(world.contracts.broker).toBe(a(3));
    expect(world.roles.treasury).toBe(a(7));
  });

  it('names the missing field', () => {
    const { broker: _broker, ...contracts } = manifest().contracts;
    expect(() => parseWorld({ ...manifest(), contracts })).toThrow(/contracts\.broker/);
  });

  it('refuses a malformed address', () => {
    const bad = manifest();
    bad.roles.treasury = '0x12';
    expect(() => parseWorld(bad)).toThrow(/roles\.treasury/);
  });
});
