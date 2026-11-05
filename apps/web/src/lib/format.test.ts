import { money } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { formatAmount, formatRate, shownAmount } from './format.ts';

const argt = (units: bigint) => money(units, 18, 'ARGt');

describe('formatAmount', () => {
  it('groups thousands and keeps two decimals from one unit up', () => {
    expect(formatAmount(argt(16_583_687_091_406_446_008_011n))).toBe('16,583.69 ARGt');
    expect(formatAmount(argt(10n ** 18n))).toBe('1.00 ARGt');
  });

  it('keeps two to four decimals below one unit and rounds half up', () => {
    expect(formatAmount(argt(0n))).toBe('0.00 ARGt');
    expect(formatAmount(argt(500_000_000_000_000_000n))).toBe('0.50 ARGt');
    expect(formatAmount(argt(123_450_000_000_000_000n))).toBe('0.1235 ARGt');
    expect(formatAmount(argt(999_960_000_000_000_000n))).toBe('1.00 ARGt');
  });

  it('writes USD with a dollar sign', () => {
    expect(formatAmount(money(9_999_999_997_371_183n, 18, 'USD'))).toBe('$0.01');
    expect(formatAmount(money(10_000_000_000_000_000n, 18, 'USD'))).toBe('$0.01');
    expect(formatAmount(money(1_000_000n, 6, 'USDC'))).toBe('1.00 USDC');
  });

  it('keeps full precision next to the short text', () => {
    expect(shownAmount(argt(16_583_789_546_469_718_423n))).toEqual({
      text: '16.58 ARGt',
      full: '16.583789546469718423 ARGt',
    });
  });
});

describe('formatRate', () => {
  it('turns the USD price of a token into tokens per USD with one decimal', () => {
    expect(formatRate(money(602_998_486_683_567n, 18, 'USD'), 'ARGt')).toBe('1 USD = 1658.4 ARGt');
  });

  it('falls back to the raw value for a zero rate', () => {
    expect(formatRate(money(0n, 18, 'USD'), 'ARGt')).toBe('0.000000000000000000 USD');
  });
});
