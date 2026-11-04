import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWalletConfig } from './wallet-config.ts';

const src = resolve(import.meta.dirname, '..');

describe('createWalletConfig', () => {
  it('knows Fuji only', () => {
    expect(createWalletConfig().chains.map((c) => c.id)).toEqual([43113]);
  });

  it('offers injected wallets only', () => {
    expect(createWalletConfig().connectors.map((c) => c.type)).toEqual(['injected']);
  });
});

describe('wallet scope', () => {
  const importing = (word: string) =>
    globSync('**/*.{ts,tsx}', { cwd: src })
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => new RegExp(`from '${word}`).test(readFileSync(resolve(src, file), 'utf8')))
      .sort();

  it('loads wagmi only through the wallet config and provider', () => {
    expect(importing('wagmi')).toEqual(['containers/wallet-provider.tsx', 'lib/wallet-config.ts']);
  });
});
