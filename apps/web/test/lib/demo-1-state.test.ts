import { type AgentEvent, money } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { balanceView, dedupeFrames, deriveDemo1 } from '../../src/lib/demo-1-state.ts';
import type { Envelope } from '../../src/lib/envelope.ts';
import { feedback, paymentRequired, received, runFinished, runStarted } from '../events.ts';

const at = 1_700_000_000_000;
const frames = (...events: AgentEvent[]): Envelope[] =>
  events.map((event, i) => ({ seq: i + 1, source: 'live', event }));
const reasoning: AgentEvent = { version: 1, at, type: 'llm.reasoning', text: 'I read the rate' };
const toolCall: AgentEvent = { version: 1, at, type: 'llm.tool-call', tool: 'read_rate', input: { asset: 'ARGt' } };
const signed: AgentEvent = {
  version: 1,
  at,
  type: 'payment.signed',
  intent: {
    id: '0xpay',
    payer: '0x0000000000000000000000000000000000000001',
    payee: '0x0000000000000000000000000000000000000002',
    amount: money(1_000_000n, 6, 'USDC'),
    chainId: 43114,
    status: 'Pending',
  },
};
const refused: AgentEvent = {
  version: 1,
  at,
  type: 'policy.decision',
  amount: money(1_000_000n, 6, 'USDC'),
  allowed: false,
  reason: 'over the budget',
};
const quoteWith = (patch: Partial<Extract<AgentEvent, { type: 'payment.required' }>['quote']>): AgentEvent =>
  paymentRequired.type === 'payment.required'
    ? { ...paymentRequired, quote: { ...paymentRequired.quote, ...patch } }
    : paymentRequired;

describe('dedupeFrames', () => {
  it('drops a repeated or older seq', () => {
    const [one, two] = frames(runStarted, reasoning) as [Envelope, Envelope];
    expect(dedupeFrames([one, two, one, two, { ...two, seq: 1 }]).map((f) => f.seq)).toEqual([1, 2]);
  });

  it('lists a repeated frame once in the timeline', () => {
    const [one, two] = frames(reasoning, toolCall) as [Envelope, Envelope];
    expect(deriveDemo1([one, two, two]).timeline.map((t) => t.seq)).toEqual([1, 2]);
  });
});

describe('deriveDemo1', () => {
  it('orders the timeline and completes the strip on the happy path', () => {
    const view = deriveDemo1(frames(reasoning, toolCall, paymentRequired, signed, received, runFinished));
    expect(view.timeline.map((t) => t.kind)).toEqual([
      'llm.reasoning',
      'llm.tool-call',
      'payment.required',
      'payment.signed',
      'resource.received',
      'run.finished',
    ]);
    expect(view.timeline[1]).toMatchObject({ detail: 'read_rate', value: '{"asset":"ARGt"}' });
    expect(view.strip).toEqual({ required: 'done', paid: 'done', received: 'done' });
    expect(view.finished).toEqual({ reason: 'done', failed: false });
  });

  it('stops the strip at a refusal and shows the reason as an error', () => {
    const stop: AgentEvent = { ...runFinished, type: 'run.finished', reason: 'refusal', message: 'over the budget' };
    const view = deriveDemo1(frames(paymentRequired, refused, stop));
    expect(view.strip).toEqual({ required: 'done', paid: 'stopped', received: 'idle' });
    expect(view.timeline.at(-2)).toMatchObject({ kind: 'policy.decision', detail: 'over the budget', failed: true });
    expect(view.timeline.at(-1)).toMatchObject({ kind: 'run.finished', value: 'refusal', failed: true });
    expect(view.finished).toMatchObject({ reason: 'refusal', message: 'over the budget', failed: true });
  });

  it('stops at the 402 step when the run fails before any quote', () => {
    const view = deriveDemo1(frames({ ...runFinished, type: 'run.finished', reason: 'error', message: 'down' }));
    expect(view.strip).toEqual({ required: 'stopped', paid: 'idle', received: 'idle' });
    expect(view.quote).toBeUndefined();
  });

  it('takes the quote from payment.required only', () => {
    expect(deriveDemo1(frames(runStarted, reasoning, toolCall)).quote).toBeUndefined();
    expect(deriveDemo1(frames(paymentRequired)).quote).toEqual({
      source: 'curve',
      rate: { text: '1 USD = 1.0 ARGt', full: '1.000000 USD' },
      amount: { text: '2.50 ARGt', full: '2.500000000000000000 ARGt' },
      price: { text: '1.00 USDC', full: '1.000000 USDC' },
      validUntil: '22:14:20 UTC',
      guarded: false,
    });
    expect(deriveDemo1(frames(quoteWith({ source: 'chainlink', guarded: true }))).quote).toMatchObject({
      source: 'chainlink',
      guarded: true,
    });
  });

  it('formats money from units without floating point', () => {
    const exact = quoteWith({ amount: money(2_500_000_000_000_000_001n, 18, 'ARGt') });
    expect(deriveDemo1(frames(exact)).quote?.amount).toEqual({
      text: '2.50 ARGt',
      full: '2.500000000000000001 ARGt',
    });
  });

  it('lists fork hashes from payment.status and identity.feedback', () => {
    const status: AgentEvent = {
      version: 1,
      at,
      type: 'payment.status',
      paymentId: '0xpay',
      chainId: 43114,
      from: 'Pending',
      to: 'Settled',
      txHash: `0x${'cd'.repeat(32)}`,
    };
    const view = deriveDemo1(frames(status, feedback));
    expect(view.forkHashes).toEqual([
      {
        seq: 1,
        kind: 'payment.status',
        hash: status.type === 'payment.status' ? status.txHash : '',
        transition: { from: 'Pending', to: 'Settled' },
      },
      { seq: 2, kind: 'identity.feedback', hash: `0x${'ab'.repeat(32)}` },
    ]);
  });
});

describe('balanceView', () => {
  const before = { agent: '16583687000000000000000', seller: '0' };
  const after = { agent: '16581187000000000000000', seller: '2500000000000000000' };

  it('shows the moved amount as the difference', () => {
    const view = balanceView(before, after);
    expect(view?.moved).toEqual({ text: '2.50 ARGt', full: '2.500000000000000000 ARGt' });
    expect(view?.agent).toEqual({
      before: { text: '16,583.69 ARGt', full: '16583.687000000000000000 ARGt' },
      after: { text: '16,581.19 ARGt', full: '16581.187000000000000000 ARGt' },
      change: { text: '-2.50 ARGt', full: '-2.500000000000000000 ARGt' },
    });
    expect(view?.seller.change?.text).toBe('+2.50 ARGt');
  });

  it('shows only the before balance until the run ends, and nothing without it', () => {
    expect(balanceView(before, undefined)).toMatchObject({ agent: { before: { text: '16,583.69 ARGt' } } });
    expect(balanceView(before, undefined)?.moved).toBeUndefined();
    expect(balanceView(undefined, after)).toBeUndefined();
    expect(balanceView({ agent: 'x', seller: '0' }, undefined)).toBeUndefined();
  });
});
