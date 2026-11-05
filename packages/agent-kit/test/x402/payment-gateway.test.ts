import { type AgentEvent, type Money, money } from '@hackatwin/core';
import { FakeAgentPolicy, FakeChainClient, readKey } from '@hackatwin/core/testing';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { PERMIT2_ADDRESS } from '@x402/evm';
import { describe, expect, it } from 'vitest';
import type { Settlement, X402Engine } from '../../src/x402/engine.ts';
import {
  AboveMaxAmountError,
  AllowanceShortfallError,
  PaymentDeniedError,
  PaymentRequirementsError,
} from '../../src/x402/errors.ts';
import { usdAtRate, X402PaymentGateway } from '../../src/x402/payment-gateway.ts';

const ASSET = '0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B';
const OWNER = '0x7Ea1e5EF86548a506C81085099b356fD0B7B9EFC';
const PAY_TO = '0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5';
const URL = 'http://127.0.0.1:4021/quote';
const RATE = money(603n, 6, 'USD');
const MAX = money(100n, 18, 'ARGt');

const requirements = (amount: string, overrides: Partial<PaymentRequirements> = {}): PaymentRequirements => ({
  scheme: 'exact',
  network: 'eip155:43114',
  asset: ASSET,
  amount,
  payTo: PAY_TO,
  maxTimeoutSeconds: 30,
  extra: { assetTransferMethod: 'permit2', quote: { source: 'curve', guarded: false, rate: '0.000603 USD' } },
  ...overrides,
});

interface Setup {
  readonly events: AgentEvent[];
  readonly signed: PaymentRequirements[];
  readonly policy: FakeAgentPolicy;
  readonly sent: Record<string, string>[];
  readonly gateway: X402PaymentGateway;
}

function setup(
  options: {
    ask?: string;
    allowance?: bigint;
    required?: Partial<PaymentRequired>;
    accepts?: PaymentRequirements[];
    first?: Response;
    paid?: Response;
    settlement?: Settlement | undefined;
    policy?: FakeAgentPolicy;
  } = {},
): Setup {
  const events: AgentEvent[] = [];
  const signed: PaymentRequirements[] = [];
  const sent: Record<string, string>[] = [];
  const policy = options.policy ?? new FakeAgentPolicy();
  const required: PaymentRequired = {
    x402Version: 2,
    resource: { url: URL },
    accepts: options.accepts ?? [requirements(options.ask ?? '100')],
    ...options.required,
  };
  const engine: X402Engine = {
    required: async () => required,
    sign: async (_required, accepted) => {
      signed.push(accepted);
      return { 'PAYMENT-SIGNATURE': 'signature' };
    },
    settlement: () =>
      'settlement' in options ? options.settlement : { success: true, transaction: `0x${'ab'.repeat(32)}` },
  };
  const fetcher = (async (_url: string, init: { headers?: Record<string, string> } = {}) => {
    sent.push(init.headers ?? {});
    return init.headers?.['PAYMENT-SIGNATURE'] === undefined
      ? (options.first ?? new Response('{}', { status: 402 }))
      : (options.paid ?? new Response('{"pair":"ARS/USD"}', { status: 200 }));
  }) as unknown as typeof fetch;
  const chain = new FakeChainClient({
    chainId: 43114,
    reads: { [readKey(ASSET, 'allowance', [OWNER, PERMIT2_ADDRESS])]: options.allowance ?? 10n ** 30n },
  });
  const gateway = new X402PaymentGateway({
    engine,
    chain,
    policy,
    emit: (event) => events.push(event),
    owner: OWNER,
    asset: ASSET,
    usdValue: (ask: Money) => usdAtRate(ask, RATE),
    fetch: fetcher,
    now: () => 1_000,
    newId: () => 'pay-1',
  });
  return { events, signed, policy, sent, gateway };
}

const request = { url: URL, method: 'GET' as const, maxAmount: MAX };

describe('X402PaymentGateway', () => {
  it('emits 402, signed, settled and 200 in order and returns the paid response', async () => {
    const { events, gateway, signed, policy } = setup();
    const response = await gateway.pay(request);
    expect(events.map((event) => event.type)).toEqual([
      'payment.required',
      'payment.signed',
      'payment.status',
      'resource.received',
    ]);
    expect(events[2]).toMatchObject({ paymentId: 'pay-1', chainId: 43114, from: 'Pending', to: 'Settled' });
    expect(response).toMatchObject({ status: 200, body: '{"pair":"ARS/USD"}', payment: { status: 'Settled' } });
    expect(signed).toHaveLength(1);
    expect(policy.authorized).toEqual([usdAtRate(money(100n, 18, 'ARGt'), RATE)]);
    expect(policy.recorded).toEqual(policy.authorized);
  });

  it('shows the seller rate source in payment.required without trusting it for the ceiling', async () => {
    const { events, gateway } = setup();
    await gateway.pay(request);
    expect(events[0]).toMatchObject({
      type: 'payment.required',
      resource: URL,
      quote: { source: 'curve', guarded: false, rate: money(603n, 6, 'USD'), amount: money(100n, 18, 'ARGt') },
    });
  });

  it('signs when the ask equals maxAmount', async () => {
    const { gateway, signed } = setup({ ask: '100' });
    await gateway.pay(request);
    expect(signed).toHaveLength(1);
  });

  it('refuses above maxAmount, emits above_max_amount, signs nothing and leaves the policy untouched', async () => {
    const { events, gateway, signed, policy, sent } = setup({ ask: '101' });
    await expect(gateway.pay(request)).rejects.toBeInstanceOf(AboveMaxAmountError);
    expect(signed).toEqual([]);
    expect(policy.authorized).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'policy.decision', allowed: false, reason: 'above_max_amount' });
  });

  it('throws the typed shortfall error and signs nothing when the allowance is below the amount', async () => {
    const { gateway, signed } = setup({ allowance: 99n });
    const failure = await gateway.pay(request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AllowanceShortfallError);
    expect(failure).toMatchObject({ allowance: 99n, amount: 100n });
    expect(signed).toEqual([]);
  });

  it('signs when the allowance equals the amount', async () => {
    const { gateway, signed } = setup({ allowance: 100n });
    await gateway.pay(request);
    expect(signed).toHaveLength(1);
  });

  it('rejects a 402 that asks for an approval extension', async () => {
    const { gateway, signed } = setup({ required: { extensions: { erc20ApprovalGasSponsoring: { info: {} } } } });
    await expect(gateway.pay(request)).rejects.toBeInstanceOf(PaymentRequirementsError);
    expect(signed).toEqual([]);
  });

  it('rejects a 402 without an exact Permit2 option for ARGt', async () => {
    const other = requirements('100', { asset: '0x0000000000000000000000000000000000000001' });
    const eip3009 = requirements('100', { extra: { name: 'x', version: '1' } });
    const { gateway, signed } = setup({ accepts: [other, eip3009] });
    await expect(gateway.pay(request)).rejects.toBeInstanceOf(PaymentRequirementsError);
    expect(signed).toEqual([]);
  });

  it('stops before signing when the policy denies', async () => {
    const policy = new FakeAgentPolicy(() => ({ allowed: false, reason: 'over_total' }));
    const { gateway, signed } = setup({ policy });
    await expect(gateway.pay(request)).rejects.toBeInstanceOf(PaymentDeniedError);
    expect(signed).toEqual([]);
  });

  it('reports Rejected, with no 200 event, when the seller answers 402 again after signing', async () => {
    const { events, gateway } = setup({ paid: new Response('{}', { status: 402 }), settlement: undefined });
    const response = await gateway.pay(request);
    expect(response).toMatchObject({ status: 402, payment: { status: 'Rejected' } });
    expect(events.map((event) => event.type)).toEqual(['payment.required', 'payment.signed', 'payment.status']);
    expect(events[2]).toMatchObject({ to: 'Rejected', txHash: `0x${'0'.repeat(64)}` });
  });

  it('does not treat a 200 without a successful settlement as paid', async () => {
    const { events, gateway, policy } = setup({ settlement: { success: false, transaction: '' } });
    expect(await gateway.pay(request)).toMatchObject({ payment: { status: 'Rejected' } });
    expect(events.some((event) => event.type === 'resource.received')).toBe(false);
    expect(policy.recorded).toEqual([]);
  });

  it('passes a non-402 answer through without paying', async () => {
    const { gateway, signed, events } = setup({ first: new Response('free', { status: 200 }) });
    expect(await gateway.pay(request)).toEqual({ status: 200, body: 'free' });
    expect(signed).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe('usdAtRate', () => {
  it('rounds up to the next USD unit', () => {
    expect(usdAtRate(money(1n, 18, 'ARGt'), RATE)).toEqual(money(1n, 6, 'USD'));
    expect(usdAtRate(money(10n ** 18n, 18, 'ARGt'), RATE)).toEqual(money(603n, 6, 'USD'));
  });
});
