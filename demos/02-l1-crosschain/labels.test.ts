import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BANNER, findLiveReferences, simulatedOf } from './labels.ts';

describe('simulatedOf', () => {
  it('marks the local-crosschain profile', () => {
    expect(simulatedOf({ name: 'local-crosschain' })).toBe('local-crosschain');
  });

  it('leaves every other profile unmarked', () => {
    expect(simulatedOf({ name: 'cchain-fork' })).toBeUndefined();
    expect(simulatedOf({ name: 'fuji-crosschain' })).toBeUndefined();
  });
});

describe('findLiveReferences', () => {
  it('finds each live pattern regardless of case', () => {
    const text = 'Sepolia, CCIP.CHAIN.LINK/msg, testnet.snowtrace.io and HTTPS://x.dev';
    expect(findLiveReferences(text).map((m) => m.toLowerCase())).toEqual([
      'sepolia',
      'ccip.chain.link',
      'snowtrace',
      'https://',
    ]);
  });

  it('finds nothing in the banner or a local hop line', () => {
    expect(findLiveReferences(`${BANNER}\nhop 3 icm Received on chain 31338 tx 0x01`)).toEqual([]);
  });
});

const SELECTOR = '16015286601757825753';
const here = dirname(fileURLToPath(import.meta.url));
const sources = [
  'labels.ts',
  'root.ts',
  ...readdirSync(join(here, 'payment-agent'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join('payment-agent', f)),
];

describe('selector-free labels', () => {
  it('labels a profile with the Sepolia-equal source selector from the profile, never Sepolia', () => {
    const profile = { name: 'local-crosschain', sourceSelector: SELECTOR };
    const marker = simulatedOf(profile) ?? '';
    expect(marker).toBe('local-crosschain');
    expect(`${BANNER} ${marker}`).not.toMatch(/sepolia/i);
  });

  it('keeps the selector and chain-name lookups out of the local label code', () => {
    for (const file of sources) {
      const text = readFileSync(join(here, file), 'utf8');
      expect(text, file).not.toContain(SELECTOR);
      // labels.ts names Sepolia only in its live-reference deny-list.
      if (file !== 'labels.ts') expect(text, file).not.toMatch(/sepolia/i);
      expect(text, file).not.toMatch(/selector\s*(to|->|=>)\s*name|chainNameBySelector|nameOfSelector/i);
    }
  });
});
