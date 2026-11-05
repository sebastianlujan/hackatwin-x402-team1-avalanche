import { type AgentEvent, formatMoney, money } from '@hackatwin/core';
import type { BalanceSnapshot } from '../adapters/balances.ts';

const argt = (units: bigint): string => formatMoney(money(units < 0n ? -units : units, 18, 'ARGt'));
const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();

// One terminal line per event, in the order the demo narrates them.
export function formatEvent(event: AgentEvent): string {
  switch (event.type) {
    case 'run.started':
      return `run started: agent ${event.agent}, profile ${event.profile}, llm ${event.llm}`;
    case 'llm.reasoning':
      return `reasoning: ${flat(event.text)}`;
    case 'llm.tool-call':
      return `tool call: ${event.tool}`;
    case 'payment.required':
      return `402 payment required: ${formatMoney(event.quote.amount)} (rate ${formatMoney(event.quote.rate)}, source ${event.quote.source})`;
    case 'policy.decision':
      return `policy decision: ${event.allowed ? 'allowed' : 'denied'} ${formatMoney(event.amount)} (${event.reason})`;
    case 'payment.signed':
      return `signature: Permit2 transfer of ${formatMoney(event.intent.amount)} to ${event.intent.payee}`;
    case 'payment.status':
      return `payment ${event.from} -> ${event.to} (tx ${event.txHash})`;
    case 'resource.received':
      return `${event.status} resource received: ${event.resource}`;
    case 'identity.feedback':
      return `feedback: positive rating for seller agentId ${event.agentId} (tx ${event.txHash})`;
    case 'hop':
      return `hop ${event.hop.index}: ${event.hop.transport}`;
    case 'run.finished':
      return `run finished: ${event.reason}${event.message === undefined ? '' : ` (${flat(event.message)})`}`;
  }
}

export function formatBalances(label: 'before' | 'after', balances: BalanceSnapshot): string[] {
  return [`ARGt balances ${label}:`, `  agent  ${argt(balances.agent)}`, `  seller ${argt(balances.seller)}`];
}

export function formatDeltas(before: BalanceSnapshot, after: BalanceSnapshot): string[] {
  const sign = (delta: bigint): string => `${delta < 0n ? '-' : '+'}${argt(delta)}`;
  return [
    'ARGt moved:',
    `  agent  ${sign(after.agent - before.agent)}`,
    `  seller ${sign(after.seller - before.seller)}`,
  ];
}
