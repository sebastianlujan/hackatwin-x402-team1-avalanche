import { type AgentEvent, type Feedback, type Hex, money, type PaidResponse, parseMoney } from '@hackatwin/core';
import { FakePaymentGateway, FakePriceOracle } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import { createBuyerTools, type SellerRating } from './tools.ts';

const SELLER = '0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5';
const AGENT = '0x7Ea1e5EF86548a506C81085099b356fD0B7B9EFC';
const TX: Hex = `0x${'ab'.repeat(32)}`;
const RATE = money(603n, 6, 'USD');
const PER_PAYMENT = parseMoney('1', 6, 'USD');
const oracle = new FakePriceOracle(RATE, () => 0);

const settled = (status = 200): PaidResponse => ({
  status,
  body: '{"pair":"ARS/USD"}',
  payment: {
    id: 'p1',
    payer: AGENT,
    payee: SELLER,
    amount: money(16n * 10n ** 18n, 18, 'ARGt'),
    chainId: 43114,
    status: status === 200 ? 'Settled' : 'Rejected',
  },
});

function setup(options: { responses?: PaidResponse[]; owner?: string } = {}) {
  const gateway = new FakePaymentGateway(options.responses ?? [settled()]);
  const usd: bigint[] = [];
  const feedback: Feedback[] = [];
  const events: AgentEvent[] = [];
  const rating: SellerRating = {
    ownerOf: async () => (options.owner ?? SELLER) as `0x${string}`,
    giveFeedback: async (f) => {
      feedback.push(f);
      return TX;
    },
  };
  const tools = createBuyerTools({
    oracle,
    perPayment: PER_PAYMENT,
    url: 'http://127.0.0.1:4021/quote',
    createGateway: (usdValue) => {
      usd.push(usdValue(money(10n ** 18n, 18, 'ARGt')).units);
      return gateway;
    },
    rating,
    sellerAgentId: 1853n,
    now: () => 5,
  });
  const run = async (name: string, input: unknown = {}) => {
    const tool = tools.find((entry) => entry.name === name);
    if (tool === undefined) throw new Error(`no tool ${name}`);
    const parsed = tool.input.safeParse(input);
    return tool.run(parsed.data as never, { emit: (event) => events.push(event), policy: {} as never });
  };
  return { gateway, usd, feedback, events, run, tools };
}

describe('buyer tools', () => {
  it('exposes quote, buy and rate_seller', () => {
    expect(setup().tools.map((tool) => tool.name)).toEqual(['quote', 'buy', 'rate_seller']);
  });

  it('quote reports the buyer oracle rate', async () => {
    expect(await setup().run('quote')).toContain('1658.37');
  });

  it('buy caps the ask at the buyer own quote of the per-payment cap', async () => {
    const { gateway, run, usd } = setup();
    await run('buy');
    expect(gateway.requests[0]?.maxAmount).toEqual((await oracle.quote(PER_PAYMENT, 'ARGt')).amount);
    expect(usd).toEqual([603n]);
  });

  it('buy still meets the profile cap when the call carries a cap key', async () => {
    const { gateway, run, tools } = setup();
    const buy = tools.find((tool) => tool.name === 'buy');
    expect(buy?.input.safeParse({ cap: 1_000_000 }).data).toEqual({});
    await run('buy', { cap: 1_000_000 });
    expect(gateway.requests[0]?.maxAmount.units).toBe((await oracle.quote(PER_PAYMENT, 'ARGt')).amount.units);
  });

  it('buy fails when the payment is not settled', async () => {
    const { run } = setup({ responses: [settled(402)] });
    await expect(run('buy')).rejects.toThrow('HTTP 402');
  });
});

describe('rate_seller', () => {
  it('posts one positive rating after a 200 and emits identity.feedback', async () => {
    const { run, feedback, events } = setup();
    await run('buy');
    await run('rate_seller');
    expect(feedback).toEqual([{ agentId: 1853n, value: 1n, valueDecimals: 0, tag1: 'x402', tag2: 'fx-quote' }]);
    expect(events).toEqual([{ version: 1, type: 'identity.feedback', at: 5, agentId: 1853n, txHash: TX }]);
  });

  it('posts nothing before a purchase', async () => {
    const { run, feedback } = setup();
    await expect(run('rate_seller')).rejects.toThrow('no completed purchase');
    expect(feedback).toEqual([]);
  });

  it('posts nothing after a failed purchase', async () => {
    const { run, feedback } = setup({ responses: [settled(402)] });
    await run('buy').catch(() => undefined);
    await expect(run('rate_seller')).rejects.toThrow('no completed purchase');
    expect(feedback).toEqual([]);
  });

  it('posts nothing when the seller agentId is not owned by the paid address', async () => {
    const { run, feedback } = setup({ owner: AGENT });
    await run('buy');
    await expect(run('rate_seller')).rejects.toThrow('not owned by the address that was paid');
    expect(feedback).toEqual([]);
  });

  it('rates only once per run', async () => {
    const { run, feedback } = setup();
    await run('buy');
    await run('rate_seller');
    await expect(run('rate_seller')).rejects.toThrow('already rated');
    expect(feedback).toHaveLength(1);
  });
});
