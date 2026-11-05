import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as browser from './browser.ts';
import { ChainError } from './chain-error.ts';
import { txUrl } from './explorer.ts';
import * as root from './index.ts';
import * as registry from './registry.ts';
import { toViemChain } from './registry.ts';

const hash = `0x${'ab'.repeat(32)}`;
const source = (file: string) => readFileSync(resolve(import.meta.dirname, file), 'utf8');

describe('txUrl', () => {
  it('links a Fuji hash to the viem explorer', () => {
    expect(txUrl('fuji', hash)).toBe(`${toViemChain('fuji').blockExplorers?.default.url}/tx/${hash}`);
    expect(txUrl('fuji', hash)).toMatch(/^https:\/\/.+\/tx\/0x[0-9a-f]{64}$/);
    expect(txUrl('fuji', hash.toUpperCase().replace('0X', '0x'))).toContain('/tx/0x');
  });

  it('is undefined for the fork-only C-Chain, a planned chain and a malformed hash', () => {
    expect(txUrl('cchain', hash)).toBeUndefined();
    expect(txUrl('twinpay-l1', hash)).toBeUndefined();
    for (const bad of ['', '0x', hash.slice(0, -1), hash.slice(2), `${hash}0`, `0x${'zz'.repeat(32)}`])
      expect(txUrl('fuji', bad), bad).toBeUndefined();
  });

  it('names an unknown chain key', () => {
    expect(() => txUrl('mainnet', hash)).toThrow(ChainError);
    expect(() => txUrl('mainnet', hash)).toThrow(/unknown chain "mainnet"/);
  });
});

describe('@hackatwin/chains/registry', () => {
  it('exports only the registry and txUrl', () => {
    expect(Object.keys(browser).sort()).toEqual([...Object.keys(registry), 'txUrl'].sort());
  });

  it('keeps node: modules out of its graph and leaves the root index alone', () => {
    for (const file of ['browser.ts', 'explorer.ts', 'registry.ts', 'chain-error.ts'])
      expect(source(file), file).not.toMatch(/from 'node:|from "node:|require\(/);
    expect(source('index.ts')).not.toMatch(/explorer|browser/);
    expect(Object.keys(root)).not.toContain('txUrl');
  });
});
