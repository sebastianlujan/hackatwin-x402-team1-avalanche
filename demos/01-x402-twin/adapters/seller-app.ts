import { AsyncLocalStorage } from 'node:async_hooks';
import type { Address, PriceOracle, Quote } from '@hackatwin/core';
import { type FacilitatorClient, x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware } from '@x402/hono';
import { Hono } from 'hono';
import { createArgtMoneyParser, quoteExtra } from './argt-money-parser.ts';
import { NETWORK } from './x402-facilitator.ts';

export const MAX_TIMEOUT_SECONDS = 30;
export const DISCLAIMER = 'market rate, not official';

export interface SellerOptions {
  readonly oracle: PriceOracle;
  readonly asset: Address;
  readonly payTo: Address;
  readonly facilitator: FacilitatorClient;
  // USD price per quote as a decimal string.
  readonly price?: string;
}

export const paidQuoteBody = (quote: Quote) => ({
  pair: 'ARS/USD',
  quote: { ...quoteExtra(quote), validUntil: quote.validUntil },
  sources: ['Curve', 'Chainlink'],
  disclaimer: DISCLAIMER,
});

export function createSellerApp({ oracle, asset, payTo, facilitator, price = '0.01' }: SellerOptions): Hono {
  // The quote that priced this request, so the paid body shows the rate that was charged.
  const priced = new AsyncLocalStorage<{ quote?: Quote; oracleFailed?: boolean }>();
  // The SDK middleware turns a parser error into its own 500, so the failure is flagged for a 503.
  const watched: PriceOracle = {
    quote: async (...args) => {
      try {
        return await oracle.quote(...args);
      } catch (error) {
        const store = priced.getStore();
        if (store) store.oracleFailed = true;
        throw error;
      }
    },
  };
  const scheme = new ExactEvmScheme().registerMoneyParser(
    createArgtMoneyParser({
      oracle: watched,
      asset,
      onQuote: (quote) => {
        const store = priced.getStore();
        if (store) store.quote = quote;
      },
    }),
  );
  const server = new x402ResourceServer(facilitator).register(NETWORK, scheme);
  const app = new Hono();
  app.use((c, next) =>
    priced.run({}, async () => {
      await next();
      if (priced.getStore()?.oracleFailed) c.res = c.json({ error: 'price unavailable' }, 503);
    }),
  );
  app.use(
    paymentMiddleware(
      {
        'GET /quote': {
          accepts: { scheme: 'exact', network: NETWORK, payTo, price, maxTimeoutSeconds: MAX_TIMEOUT_SECONDS },
          description: 'ARS/USD market rate, priced in USD and charged in ARGt',
          mimeType: 'application/json',
        },
      },
      server,
    ),
  );
  app.get('/quote', (c) => {
    const quote = priced.getStore()?.quote;
    return quote === undefined ? c.json({ error: 'no quote' }, 500) : c.json(paidQuoteBody(quote));
  });
  return app;
}
