import type { AssetSymbol, Money } from '../domain/money.ts';
import type { Quote } from '../domain/payment.ts';

export interface PriceOracle {
  quote(price: Money, asset: AssetSymbol): Promise<Quote>;
}
