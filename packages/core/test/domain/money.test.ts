import { describe, expect, it } from 'vitest';
import { convertMoney, formatMoney, money, parseMoney } from '../../src/domain/money.ts';

const usd = (units: bigint) => money(units, 6, 'USD');

describe('money', () => {
  it('rejects negative units and bad decimals', () => {
    expect(() => money(-1n, 6, 'USD')).toThrow(/negative/);
    expect(() => money(1n, -1, 'USD')).toThrow(/Invalid decimals/);
    expect(() => money(1n, 1.5, 'USD')).toThrow(/Invalid decimals/);
  });
});

describe('parse and format', () => {
  it('parses whole and fractional amounts', () => {
    expect(parseMoney('1.5', 6, 'USD').units).toBe(1_500_000n);
    expect(parseMoney('2', 6, 'USD').units).toBe(2_000_000n);
    expect(parseMoney('3', 0, 'USD').units).toBe(3n);
  });

  it('rejects malformed text and extra digits', () => {
    expect(() => parseMoney('1.2.3', 6, 'USD')).toThrow(/Invalid amount/);
    expect(() => parseMoney('-1', 6, 'USD')).toThrow(/Invalid amount/);
    expect(() => parseMoney('0.1234567', 6, 'USD')).toThrow(/exceeds 6 decimals/);
  });

  it('formats with currency and keeps leading zeros', () => {
    expect(formatMoney(usd(1_500_000n))).toBe('1.500000 USD');
    expect(formatMoney(usd(5n))).toBe('0.000005 USD');
    expect(formatMoney(money(7n, 0, 'USDC'))).toBe('7 USDC');
  });
});

describe('convertMoney', () => {
  const rate = money(2_000_000n, 6, 'USD');

  it('converts exactly when divisible', () => {
    const out = convertMoney(usd(1_000_000n), rate, { decimals: 18, currency: 'ARGt' });
    expect(out).toEqual(money(500_000_000_000_000_000n, 18, 'ARGt'));
  });

  it('rounds up when not divisible', () => {
    const out = convertMoney(money(1n, 6, 'USD'), money(3_000_000n, 6, 'USD'), { decimals: 6, currency: 'USDC' });
    expect(out.units).toBe(1n);
  });

  it('rejects a rate in another currency or a zero rate', () => {
    const target = { decimals: 6, currency: 'USDC' } as const;
    expect(() => convertMoney(usd(1n), money(1n, 6, 'USDC'), target)).toThrow(/does not match/);
    expect(() => convertMoney(usd(1n), usd(0n), target)).toThrow(/zero/);
  });
});
