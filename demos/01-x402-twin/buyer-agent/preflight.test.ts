import { describe, expect, it } from 'vitest';
import { type PreflightDeps, preflight } from './preflight.ts';

function deps(overrides: Partial<PreflightDeps> = {}): { deps: PreflightDeps; calls: string[] } {
  const calls: string[] = [];
  const base: PreflightDeps = {
    refusal: undefined,
    expectedBlock: 99n,
    forkBlock: async () => 99n,
    syncClock: async () => void calls.push('clock'),
    registered: async () => true,
    funded: async () => true,
    serviceUp: async (service) => {
      calls.push(service);
      return true;
    },
  };
  return { deps: { ...base, ...overrides }, calls };
}

describe('preflight', () => {
  it('passes, syncing the clock before the services are probed', async () => {
    const { deps: ok, calls } = deps();
    await preflight(ok);
    expect(calls).toEqual(['clock', 'facilitator', 'seller']);
  });

  it('refuses a non-anvil RPC before anything else', async () => {
    const { deps: bad, calls } = deps({ refusal: 'writes are refused on this RPC' });
    await expect(preflight(bad)).rejects.toThrow('not a local anvil fork');
    expect(calls).toEqual([]);
  });

  it.each([
    ['fork block', { forkBlock: async () => 5n }, 'run pnpm demo1:fork'],
    ['registration', { registered: async () => false }, 'run pnpm demo1:register'],
    ['funding', { funded: async () => false }, 'run pnpm demo1:fund'],
    ['facilitator', { serviceUp: async (s: string) => s !== 'facilitator' }, 'run pnpm demo1:facilitator'],
    ['seller', { serviceUp: async (s: string) => s !== 'seller' }, 'run pnpm demo1:seller'],
  ] satisfies [string, Partial<PreflightDeps>, string][])(
    'names the fix when the %s is missing',
    async (_name, change, fix) => {
      await expect(preflight(deps(change).deps)).rejects.toThrow(fix);
    },
  );
});
