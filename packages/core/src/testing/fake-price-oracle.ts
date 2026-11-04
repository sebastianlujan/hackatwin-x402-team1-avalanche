import { type AssetSymbol, convertMoney, type Money } from '../domain/money.ts';
import type { Quote } from '../domain/payment.ts';
import type { PriceOracle } from '../ports/price-oracle.ts';

const DECIMALS: Readonly<Record<AssetSymbol, number>> = { ARGt: 18, USDC: 6 };

export class FakePriceOracle implements PriceOracle {
  private readonly rate: Money;
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(rate: Money, now: () => number, ttlMs = 60_000) {
    this.rate = rate;
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async quote(price: Money, asset: AssetSymbol): Promise<Quote> {
    const amount = convertMoney(price, this.rate, { decimals: DECIMALS[asset], currency: asset });
    return { price, rate: this.rate, amount, source: 'curve', guarded: false, validUntil: this.now() + this.ttlMs };
  }
}
