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
