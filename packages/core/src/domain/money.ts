export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type AssetSymbol = 'ARGt' | 'USDC';
export type Currency = AssetSymbol | 'USD';

export interface Money {
  readonly units: bigint;
  readonly decimals: number;
  readonly currency: Currency;
}

export class MoneyError extends Error {
  override readonly name = 'MoneyError';
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

const assertDecimals = (decimals: number): void => {
  if (!Number.isInteger(decimals) || decimals < 0) throw new MoneyError(`Invalid decimals: ${decimals}`);
};

export const money = (units: bigint, decimals: number, currency: Currency): Money => {
  assertDecimals(decimals);
  if (units < 0n) throw new MoneyError('Money units cannot be negative');
  return { units, decimals, currency };
};

export const parseMoney = (text: string, decimals: number, currency: Currency): Money => {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new MoneyError(`Invalid amount: "${text}"`);
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) throw new MoneyError(`Amount "${text}" exceeds ${decimals} decimals`);
  return money(BigInt(`${match[1]}${fraction.padEnd(decimals, '0')}`), decimals, currency);
};

export const formatMoney = (m: Money): string => {
  const digits = m.units.toString().padStart(m.decimals + 1, '0');
  const split = digits.length - m.decimals;
  const fraction = m.decimals > 0 ? `.${digits.slice(split)}` : '';
  return `${digits.slice(0, split)}${fraction} ${m.currency}`;
};

const assertSame = (a: Money, b: Money): void => {
  if (a.currency !== b.currency) throw new MoneyError(`Currency mismatch: ${a.currency} and ${b.currency}`);
  if (a.decimals !== b.decimals) throw new MoneyError(`Decimals mismatch: ${a.decimals} and ${b.decimals}`);
};

export const addMoney = (a: Money, b: Money): Money => {
  assertSame(a, b);
  return money(a.units + b.units, a.decimals, a.currency);
};

export const compareMoney = (a: Money, b: Money): -1 | 0 | 1 => {
  assertSame(a, b);
  return a.units < b.units ? -1 : a.units > b.units ? 1 : 0;
};

// rate is the price of one target unit in the amount's currency; the result rounds up
export const convertMoney = (amount: Money, rate: Money, target: { decimals: number; currency: Currency }): Money => {
  if (amount.currency !== rate.currency)
    throw new MoneyError(`Rate currency ${rate.currency} does not match ${amount.currency}`);
  if (rate.units === 0n) throw new MoneyError('Rate cannot be zero');
  assertDecimals(target.decimals);
  const numerator = amount.units * pow10(target.decimals + rate.decimals);
  const denominator = rate.units * pow10(amount.decimals);
  return money((numerator + denominator - 1n) / denominator, target.decimals, target.currency);
};
