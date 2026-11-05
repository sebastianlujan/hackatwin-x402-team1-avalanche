import { txUrl } from '@hackatwin/chains/registry';
import { describe, expect, it } from 'vitest';
import { buildFirstTx, FIRST_TX_VALUE, FUJI_CHAIN_ID, fujiTxUrl } from '../../src/lib/first-tx.ts';

const account = `0x${'1'.repeat(40)}` as const;
const hash = `0x${'ab'.repeat(32)}`;

describe('buildFirstTx', () => {
  it('is a self-transfer of exactly 0.001 AVAX', () => {
    expect(FIRST_TX_VALUE).toBe(10n ** 15n);
    expect(buildFirstTx(account)).toEqual({ to: account, value: 10n ** 15n });
    expect(FUJI_CHAIN_ID).toBe(43113);
  });
});

describe('fujiTxUrl', () => {
  it('equals the chains helper output and is undefined without a valid hash', () => {
    expect(fujiTxUrl(hash)).toBe(txUrl('fuji', hash));
    expect(fujiTxUrl(hash)).toBeDefined();
    expect(fujiTxUrl(undefined)).toBeUndefined();
    expect(fujiTxUrl('0x1234')).toBeUndefined();
  });
});
