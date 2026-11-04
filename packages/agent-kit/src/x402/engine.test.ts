import type { PaymentRequired } from '@x402/core/types';
import { describe, expect, it } from 'vitest';
import { createX402Engine } from './engine.ts';

const required: PaymentRequired = {
  x402Version: 2,
  resource: { url: 'http://127.0.0.1:4021/quote' },
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:43114',
      asset: '0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B',
      amount: '100',
      payTo: '0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5',
      maxTimeoutSeconds: 30,
      extra: { assetTransferMethod: 'permit2' },
    },
  ],
  extensions: { erc20ApprovalGasSponsoring: { info: {} } },
};
const header = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');
const signer = {
  address: '0x7Ea1e5EF86548a506C81085099b356fD0B7B9EFC' as const,
  signTypedData: async () => `0x${'11'.repeat(65)}` as const,
};
const engine = () => createX402Engine({ signer, network: 'eip155:43114' });

describe('X402Engine', () => {
  it('decodes the PAYMENT-REQUIRED header of a 402', async () => {
    const response = new Response('{}', { status: 402, headers: { 'payment-required': header(required) } });
    expect((await engine().required(response)).accepts[0]?.amount).toBe('100');
  });

  it('signs the chosen entry and drops server extensions', async () => {
    const headers = await engine().sign(required, required.accepts[0] as never);
    const payload = JSON.parse(Buffer.from(headers['PAYMENT-SIGNATURE'] ?? '', 'base64').toString());
    expect(payload.accepted.amount).toBe('100');
    expect(payload.extensions).toBeUndefined();
    expect(payload.payload.signature).toBe(`0x${'11'.repeat(65)}`);
  });

  it('reads the PAYMENT-RESPONSE header and answers undefined without one', () => {
    const settled = new Response('{}', {
      headers: { 'payment-response': header({ success: true, transaction: '0xabc' }) },
    });
    expect(engine().settlement(settled)).toMatchObject({ success: true, transaction: '0xabc' });
    expect(engine().settlement(new Response('{}'))).toBeUndefined();
  });
});
