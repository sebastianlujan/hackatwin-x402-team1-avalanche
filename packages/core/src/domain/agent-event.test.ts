import { describe, expect, it } from 'vitest';
import { type AgentEvent, AgentEventError, decodeAgentEvent, encodeAgentEvent } from './agent-event.ts';
import { type Address, type Hex, money } from './money.ts';
import type { PaymentIntent, Quote } from './payment.ts';

const addr = `0x${'1'.repeat(40)}` as Address;
const tx = `0x${'a'.repeat(64)}` as Hex;
const big = money(2n ** 60n + 7n, 6, 'USD');
const quote: Quote = {
  price: big,
  rate: money(2_000_000n, 6, 'USD'),
  amount: money(2n ** 70n, 18, 'ARGt'),
  source: 'curve',
  guarded: true,
  validUntil: 1_700_000_000_000,
};
const intent: PaymentIntent = { id: 'p1', payer: addr, payee: addr, amount: big, chainId: 43114, status: 'Pending' };
const base = { version: 1, at: 1 } as const;

const events: AgentEvent[] = [
  { ...base, type: 'run.started', agent: 'buyer', profile: 'fuji-cchain', llm: 'scripted' },
  { ...base, type: 'llm.reasoning', text: 'thinking' },
  { ...base, type: 'llm.tool-call', tool: 'pay', input: { units: 'not-a-bigint', agentId: 'x' } },
  { ...base, type: 'policy.decision', amount: big, allowed: true, reason: 'ok' },
  { ...base, type: 'payment.required', resource: 'https://x/y', quote },
  { ...base, type: 'payment.signed', intent },
  { ...base, type: 'payment.status', paymentId: 'p1', chainId: 1, from: 'Pending', to: 'Settled', txHash: tx },
  {
    ...base,
    type: 'hop',
    messageId: 'm1',
    hop: { index: 0, transport: 'ccip', chainId: 1, status: 'Dispatched', txHash: tx, explorerUrl: 'https://e/x' },
  },
  { ...base, type: 'resource.received', resource: 'https://x/y', status: 200 },
  { ...base, type: 'identity.feedback', agentId: 2n ** 64n, txHash: tx },
  { ...base, type: 'run.finished', reason: 'done' },
];

describe('round trip', () => {
  it.each(events.map((e) => [e.type, e] as const))('%s', (_type, event) => {
    expect(decodeAgentEvent(encodeAgentEvent(event))).toEqual(event);
  });

  it('serializes amounts above 2^53 as decimal strings', () => {
    const json = encodeAgentEvent({ ...base, type: 'policy.decision', amount: big, allowed: true, reason: 'ok' });
    expect(JSON.parse(json).amount.units).toBe((2n ** 60n + 7n).toString());
  });
});

describe('rejection', () => {
  it('rejects an unknown version', () => {
    expect(() => decodeAgentEvent('{"version":2,"type":"hop"}')).toThrow(/Unsupported AgentEvent version: 2/);
  });

  it('rejects an unknown type', () => {
    expect(() => decodeAgentEvent('{"version":1,"type":"nope"}')).toThrow(/Unknown AgentEvent type: nope/);
  });

  it.each(['gpt', undefined])('rejects run.started with llm %s', (llm) => {
    const bad = { version: 1, type: 'run.started', agent: 'a', profile: 'p', at: 1, llm };
    expect(() => decodeAgentEvent(JSON.stringify(bad))).toThrow(/run.started llm must be claude or scripted/);
  });

  it('rejects non-JSON and non-object input', () => {
    expect(() => decodeAgentEvent('{')).toThrow(AgentEventError);
    expect(() => decodeAgentEvent('null')).toThrow(/must be an object/);
  });

  it('rejects non-decimal bigint fields and missing objects', () => {
    const bad = { version: 1, type: 'identity.feedback', agentId: '1.5', txHash: tx };
    expect(() => decodeAgentEvent(JSON.stringify(bad))).toThrow(/agentId must be a decimal string/);
    const noQuote = { version: 1, type: 'payment.required', resource: 'r' };
    expect(() => decodeAgentEvent(JSON.stringify(noQuote))).toThrow(/quote must be an object/);
  });
});
