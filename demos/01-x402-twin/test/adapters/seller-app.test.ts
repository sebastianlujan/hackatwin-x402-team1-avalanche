import { type Money, money, type PriceOracle, type Quote } from '@hackatwin/core';
import { FakePriceOracle } from '@hackatwin/core/testing';
import type { FacilitatorClient } from '@x402/core/server';
import type { PaymentRequired } from '@x402/core/types';
import { describe, expect, it, vi } from 'vitest';
import { createSellerApp, DISCLAIMER, MAX_TIMEOUT_SECONDS } from '../../adapters/seller-app.ts';

const ASSET = '0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B';
const PAY_TO = '0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5';
const NETWORK = 'eip155:43114';
const RATE = money(603n, 6, 'USD');
const NOW = 1_800_000_000_000;

const facilitator = (settle: FacilitatorClient['settle']): FacilitatorClient => ({
  verify: async () => ({ isValid: true }),
  settle,
  getSupported: async () => ({
    kinds: [{ x402Version: 2, scheme: 'exact', network: NETWORK }],
    extensions: [],
    signers: {},
  }),
});
const settles = facilitator(async () => ({ success: true, transaction: '0xabc', network: NETWORK }));
const fails = facilitator(async () => ({
  success: false,
  errorReason: 'insufficient_funds',
  transaction: '',
  network: NETWORK,
}));
const oracle = new FakePriceOracle(RATE, () => NOW);
const app = (client: FacilitatorClient, priced: PriceOracle = oracle) =>
  createSellerApp({ oracle: priced, asset: ASSET, payTo: PAY_TO, facilitator: client });

const decode = (header: string | null) => JSON.parse(Buffer.from(header ?? '', 'base64').toString()) as PaymentRequired;
const unpaid = async (sellerApp = app(settles)) => {
  const response = await sellerApp.request('/quote');
  return { response, required: decode(response.headers.get('payment-required')) };
};
const pay = async (sellerApp: ReturnType<typeof app>) => {
  const { required } = await unpaid(sellerApp);
  const payload = { x402Version: 2, accepted: required.accepts[0], payload: {} };
  return sellerApp.request('/quote', {
    headers: { 'payment-signature': Buffer.from(JSON.stringify(payload)).toString('base64') },
  });
};

describe('seller app', () => {
  it('answers an unpaid request with a 402 for the USD price converted to ARGt through Permit2', async () => {
    const { response, required } = await unpaid();
    const quote = await oracle.quote(money(10_000n, 6, 'USD'), 'ARGt');
    expect(response.status).toBe(402);
    expect(required.accepts).toHaveLength(1);
    expect(required.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: NETWORK,
      asset: ASSET,
      payTo: PAY_TO,
      amount: String(quote.amount.units),
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
    });
    const extra = required.accepts[0]?.extra;
    expect(extra?.assetTransferMethod).toBe('permit2');
    expect(extra).not.toHaveProperty('name');
    expect(extra).not.toHaveProperty('version');
  });

  it('shows the rate source and the guarded flag in the 402 requirements (extra.quote reaches the body)', async () => {
    const { required } = await unpaid();
    expect(required.accepts[0]?.extra?.quote).toEqual({ source: 'curve', guarded: false, rate: '0.000603 USD' });
  });

  it('answers 200 with the quote, its sources and the disclaimer once settled', async () => {
    const response = await pay(app(settles));
    expect(response.status).toBe(200);
    expect(response.headers.get('payment-response')).not.toBeNull();
    expect(await response.json()).toEqual({
      pair: 'ARS/USD',
      quote: { source: 'curve', guarded: false, rate: '0.000603 USD', validUntil: NOW + 60_000 },
      sources: ['Curve', 'Chainlink'],
      disclaimer: DISCLAIMER,
    });
  });

  it('returns no 200 and no quote when settlement fails', async () => {
    const response = await pay(app(fails));
    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toContain('quote');
    const settlement = JSON.parse(Buffer.from(response.headers.get('payment-response') ?? '', 'base64').toString());
    expect(settlement).toMatchObject({ success: false });
  });

  it('answers 503 and issues no 402 when the oracle fails', async () => {
    const broken: PriceOracle = {
      quote: async (_price: Money): Promise<Quote> => {
        throw new Error('oracle down');
      },
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await app(settles, broken).request('/quote');
    expect(response.status).toBe(503);
    expect(response.headers.get('payment-required')).toBeNull();
  });
});
