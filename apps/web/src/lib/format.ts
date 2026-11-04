import { formatMoney, type Money } from '@hackatwin/core';

// Short text for the screen, full precision for the presenter's title attribute.
export interface Shown {
  readonly text: string;
  readonly full: string;
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);
const group = (n: bigint): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Half-up rounding of an amount to a fixed number of decimals.
function round(m: Money, places: number): { whole: bigint; fraction: string } {
  const drop = m.decimals - places;
  const scaled = drop > 0 ? (m.units + pow10(drop) / 2n) / pow10(drop) : m.units * pow10(-drop);
  const base = pow10(places);
  return { whole: scaled / base, fraction: (scaled % base).toString().padStart(places, '0') };
}

// Two decimals from one unit up; below one unit up to four, never fewer than two.
export function formatAmount(m: Money): string {
  const small = m.units < pow10(m.decimals);
  const { whole, fraction } = round(m, small ? 4 : 2);
  const kept = small ? fraction.replace(/0+$/, '').padEnd(2, '0') : fraction;
  const number = `${group(whole)}.${kept}`;
  return m.currency === 'USD' ? `$${number}` : `${number} ${m.currency}`;
}

// The price of one USD in tokens, one decimal, like `pnpm quote`.
export function formatRate(usdPerToken: Money, token: string): string {
  if (usdPerToken.units === 0n) return formatMoney(usdPerToken);
  const tenths = (pow10(usdPerToken.decimals + 1) + usdPerToken.units / 2n) / usdPerToken.units;
  return `1 ${usdPerToken.currency} = ${tenths / 10n}.${tenths % 10n} ${token}`;
}

export const shownAmount = (m: Money): Shown => ({ text: formatAmount(m), full: formatMoney(m) });
