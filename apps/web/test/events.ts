import type { AgentEvent, Hex } from '@hackatwin/core';
import { money } from '@hackatwin/core';

const tx = `0x${'ab'.repeat(32)}` as Hex;
const price = money(1_000_000n, 6, 'USDC');
const base = { version: 1 as const, at: 1_700_000_000_000 };

export const runStarted: AgentEvent = {
  ...base,
  type: 'run.started',
  agent: 'buyer',
  profile: 'cchain-fork',
  llm: 'scripted',
};
export const paymentRequired: AgentEvent = {
  ...base,
  type: 'payment.required',
  resource: 'http://127.0.0.1:4021/data',
  quote: {
    price,
    rate: money(1_000_000n, 6, 'USD'),
    amount: money(2_500_000_000_000_000_000n, 18, 'ARGt'),
    source: 'curve',
    guarded: false,
    validUntil: base.at + 60_000,
  },
};
export const runFinished: AgentEvent = { ...base, type: 'run.finished', reason: 'done' };
export const feedback: AgentEvent = { ...base, type: 'identity.feedback', agentId: 7n, txHash: tx };
export const received: AgentEvent = {
  ...base,
  type: 'resource.received',
  resource: 'http://127.0.0.1:4021/data',
  status: 200,
};
