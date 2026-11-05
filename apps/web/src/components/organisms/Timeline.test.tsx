import { type AgentEvent, money } from '@hackatwin/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { paymentRequired, received, runFinished } from '../../../test/events.ts';
import { copy } from '../../content/copy.ts';
import { deriveDemo1 } from '../../lib/demo-1-state.ts';
import type { Envelope } from '../../lib/envelope.ts';
import { PaymentStrip } from './PaymentStrip.tsx';
import { Timeline } from './Timeline.tsx';

const at = 1_700_000_000_000;
const view = (...events: AgentEvent[]) =>
  deriveDemo1(events.map((event, i): Envelope => ({ seq: i + 1, source: 'live', event })));
const reasoning: AgentEvent = { version: 1, at, type: 'llm.reasoning', text: 'I read the rate' };
const toolCall: AgentEvent = { version: 1, at, type: 'llm.tool-call', tool: 'read_rate', input: {} };
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
const strip = (...events: AgentEvent[]): string =>
  renderToStaticMarkup(<PaymentStrip copy={copy.demo1.strip} strip={view(...events).strip} />);
const states = (markup: string): string[] => [...markup.matchAll(/data-state="(\w+)"/g)].map((m) => m[1] ?? '');

describe('Timeline and PaymentStrip', () => {
  const happy = view(reasoning, toolCall, paymentRequired, signed, received, runFinished);

  it('lists the entries in order and completes all three steps', () => {
    const markup = renderToStaticMarkup(<Timeline copy={copy.demo1.timeline} entries={happy.timeline} />);
    const order = ['I read the rate', 'read_rate', '402 quote', 'signed', 'response', 'finished'];
    const at = order.map((text) => markup.indexOf(text));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at).not.toContain(-1);
    expect(states(strip(reasoning, toolCall, paymentRequired, signed, received))).toEqual(['done', 'done', 'done']);
  });

  it('stops at the 402 on a refusal, names the reason and claims no success', () => {
    const stop: AgentEvent = { ...runFinished, type: 'run.finished', reason: 'refusal', message: 'over the budget' };
    const events = [paymentRequired, refused, stop];
    expect(states(strip(...events))).toEqual(['done', 'stopped', 'idle']);
    const markup = renderToStaticMarkup(<Timeline copy={copy.demo1.timeline} entries={view(...events).timeline} />);
    expect(markup).toContain('over the budget');
    expect(markup).toContain(`>${copy.demo1.timeline.error}<`);
  });

  it('explains the empty timeline', () => {
    expect(renderToStaticMarkup(<Timeline copy={copy.demo1.timeline} entries={[]} />)).toContain(
      copy.demo1.timeline.empty,
    );
  });
});
