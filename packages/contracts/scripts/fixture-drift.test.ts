import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftOf, type RegistryFile } from './fixture-drift.ts';

const real = join(import.meta.dirname, '../../chains/registry');
const fixtures = join(import.meta.dirname, '../test/fixtures/registry');
const read = (dir: string, name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as RegistryFile;
const names = readdirSync(fixtures).filter((name) => name.endsWith('.json'));

describe('fixture registry drift', () => {
  it('copies the chain IDs, selectors and addresses of the real registry exactly', () => {
    expect(names).toEqual(['fuji.json', 'sepolia.json', 'twinpay-l1.json']);
    for (const name of names) expect(driftOf(read(real, name), read(fixtures, name))).toEqual([]);
  });

  it('reports a fixture fact that differs from the real registry', () => {
    const fuji = read(fixtures, 'fuji.json');
    const drifted = {
      ...fuji,
      chainId: 1,
      ccip: { chainSelector: '1' },
      contracts: { ...fuji.contracts, usdc: { address: '0x0000000000000000000000000000000000000001' } },
    };
    expect(driftOf(read(real, 'fuji.json'), drifted)).toEqual([
      'fuji chainId: fixture 1, registry 43113',
      'fuji ccip.chainSelector: fixture 1, registry 14767482510784806043',
      'fuji contracts.usdc.address: fixture 0x0000000000000000000000000000000000000001, registry 0x5425890298aed601595a70AB815c96711a31Bc65',
    ]);
  });

  it('does not treat facts only the fixture has as drift', () => {
    const l1 = read(fixtures, 'twinpay-l1.json');
    expect(l1.chainId).toBe(100001);
    expect(read(real, 'twinpay-l1.json').chainId).toBeUndefined();
    expect(driftOf(read(real, 'twinpay-l1.json'), l1)).toEqual([]);
  });
});
