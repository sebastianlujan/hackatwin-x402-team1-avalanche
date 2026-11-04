import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { describe, expect, it } from 'vitest';
import { createFacilitatorApp, type FacilitatorLike, MAX_BODY_BYTES } from './facilitator-app.ts';
import { serveLoopback } from './serve.ts';

const NETWORK = 'eip155:43114';
const requirements: PaymentRequirements = {
  scheme: 'exact',
  network: NETWORK,
  asset: '0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B',
  amount: '100',
  payTo: '0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5',
  maxTimeoutSeconds: 30,
  extra: { assetTransferMethod: 'permit2' },
};
const payload: PaymentPayload = { x402Version: 2, accepted: requirements, payload: {} };

const fake = (calls: string[] = []): FacilitatorLike => ({
  supported: () => ({
    kinds: [{ x402Version: 2, scheme: 'exact', network: NETWORK }],
    extensions: [],
    signers: {},
  }),
  verify: async () => {
    calls.push('verify');
    return { isValid: true };
  },
  settle: async () => {
    calls.push('settle');
    return { success: true, transaction: '0xabc', network: NETWORK };
  },
});

const post = (app: ReturnType<typeof createFacilitatorApp>, path: string, body: string) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
const valid = (paymentRequirements: PaymentRequirements = requirements) =>
  JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements });

describe('facilitator app', () => {
  it('lists eip155:43114 with exact', async () => {
    const response = await createFacilitatorApp(fake()).request('/supported');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ kinds: [{ scheme: 'exact', network: NETWORK }] });
  });

  it('verifies and settles through the facilitator', async () => {
    const calls: string[] = [];
    const app = createFacilitatorApp(fake(calls));
    expect(await (await post(app, '/verify', valid())).json()).toEqual({ isValid: true });
    expect(await (await post(app, '/settle', valid())).json()).toMatchObject({ success: true, transaction: '0xabc' });
    expect(calls).toEqual(['verify', 'settle']);
  });

  it('rejects an unsupported network and calls nothing', async () => {
    const calls: string[] = [];
    const app = createFacilitatorApp(fake(calls));
    const other = valid({ ...requirements, network: 'eip155:1' });
    const verify = await post(app, '/verify', other);
    expect(verify.status).toBe(400);
    expect(await verify.json()).toMatchObject({ isValid: false, invalidReason: 'unsupported_network' });
    const settle = await post(app, '/settle', other);
    expect(settle.status).toBe(400);
    expect(await settle.json()).toMatchObject({ success: false, errorReason: 'unsupported_network' });
    expect(calls).toEqual([]);
  });

  it('answers malformed and schema-invalid bodies with 400', async () => {
    const app = createFacilitatorApp(fake());
    for (const body of [
      'not json',
      '{}',
      JSON.stringify({ x402Version: 2, paymentPayload: {}, paymentRequirements: {} }),
    ])
      expect((await post(app, '/verify', body)).status).toBe(400);
  });

  it('answers a body over 16 KB with 413', async () => {
    const calls: string[] = [];
    const big = JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES) });
    expect((await post(createFacilitatorApp(fake(calls)), '/settle', big)).status).toBe(413);
    expect(calls).toEqual([]);
  });

  it('hides facilitator errors behind a 500 and logs the message', async () => {
    const logged: string[] = [];
    const failing: FacilitatorLike = {
      ...fake(),
      verify: async () => {
        throw new Error('rpc down');
      },
    };
    const response = await post(
      createFacilitatorApp(failing, (m) => logged.push(m)),
      '/verify',
      valid(),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'facilitator error' });
    expect(logged).toEqual(['/verify failed: rpc down']);
  });
});

describe('serveLoopback', () => {
  it('binds 127.0.0.1 and serves the app', async () => {
    const served = await serveLoopback(createFacilitatorApp(fake()), 0);
    try {
      expect(served.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect((await fetch(`${served.url}/supported`)).status).toBe(200);
    } finally {
      await served.close();
    }
  });
});
