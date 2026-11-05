import { type AgentEvent, money } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { formatBalances, formatDeltas, formatEvent } from '../../buyer-agent/format.ts';

const at = 1;
const ARGT = (n: bigint) => money(n * 10n ** 18n, 18, 'ARGt');

describe('formatEvent', () => {
  it('names the llm on the first line', () => {
    const event: AgentEvent = {
      version: 1,
      type: 'run.started',
      at,
      agent: 'buyer',
      profile: 'cchain-fork',
      llm: 'scripted',
    };
    expect(formatEvent(event)).toBe('run started: agent buyer, profile cchain-fork, llm scripted');
  });

  it('prints the 402, the decision, the signature, the 200 and the feedback', () => {
    const quote = {
      price: money(10_000n, 6, 'USD'),
      rate: money(603n, 6, 'USD'),
      amount: ARGT(16n),
      source: 'curve' as const,
      guarded: false,
      validUntil: 1,
    };
    const lines = [
      formatEvent({ version: 1, type: 'payment.required', at, resource: 'u', quote }),
      formatEvent({
        version: 1,
        type: 'policy.decision',
        at,
        amount: money(10_000n, 6, 'USD'),
        allowed: false,
        reason: 'above_max_amount',
      }),
      formatEvent({ version: 1, type: 'resource.received', at, resource: 'http://x/quote', status: 200 }),
      formatEvent({ version: 1, type: 'identity.feedback', at, agentId: 7n, txHash: '0xab' }),
    ];
    expect(lines).toEqual([
      '402 payment required: 16.000000000000000000 ARGt (rate 0.000603 USD, source curve)',
      'policy decision: denied 0.010000 USD (above_max_amount)',
      '200 resource received: http://x/quote',
      'feedback: positive rating for seller agentId 7 (tx 0xab)',
    ]);
  });

  it('flattens multi-line reasoning and shows the finish message', () => {
    expect(formatEvent({ version: 1, type: 'llm.reasoning', at, text: 'a\n  b' })).toBe('reasoning: a b');
    expect(formatEvent({ version: 1, type: 'run.finished', at, reason: 'error', message: 'boom' })).toBe(
      'run finished: error (boom)',
    );
  });
});

describe('balances output', () => {
  it('prints before and the signed deltas', () => {
    const before = { agent: 100n * 10n ** 18n, seller: 0n };
    const after = { agent: 84n * 10n ** 18n, seller: 16n * 10n ** 18n };
    expect(formatBalances('before', before)).toEqual([
      'ARGt balances before:',
      '  agent  100.000000000000000000 ARGt',
      '  seller 0.000000000000000000 ARGt',
    ]);
    expect(formatDeltas(before, after)).toEqual([
      'ARGt moved:',
      '  agent  -16.000000000000000000 ARGt',
      '  seller +16.000000000000000000 ARGt',
    ]);
  });
});
