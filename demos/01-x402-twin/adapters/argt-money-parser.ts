import { type Address, formatMoney, type PriceOracle, parseMoney, type Quote } from '@hackatwin/core';
import type { MoneyParser } from '@x402/core/types';

export interface QuoteExtra {
  readonly source: Quote['source'];
  readonly guarded: boolean;
  readonly rate: string;
}

// No expiry here: the paid request is priced again and its `extra` must equal the advertised one.
export const quoteExtra = (quote: Quote): QuoteExtra => ({
  source: quote.source,
  guarded: quote.guarded,
  rate: formatMoney(quote.rate),
});

export interface ArgtMoneyParserOptions {
  readonly oracle: PriceOracle;
  readonly asset: Address;
  readonly onQuote: (quote: Quote) => void;
}

// Prices arrive in USD; the oracle converts them to ARGt, charged through Permit2 (no name or version).
export function createArgtMoneyParser({ oracle, asset, onQuote }: ArgtMoneyParserOptions): MoneyParser {
  return async (amount) => {
    const quote = await oracle.quote(parseMoney(String(amount), 6, 'USD'), 'ARGt');
    onQuote(quote);
    return {
      asset,
      amount: String(quote.amount.units),
      extra: { assetTransferMethod: 'permit2', quote: quoteExtra(quote) },
    };
  };
}
