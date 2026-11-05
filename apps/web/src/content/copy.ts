import { CLAUDE_DISABLED_REASON } from '../lib/starter.ts';

// Every user-facing string lives here; components receive their slice as props.
export const copy = {
  demo1: {
    brand: '> HACKATWIN',
    title: 'Demo 1',
    lead: 'An agent buys one ARGt quote over x402 on a local Avalanche C-Chain fork.',
    start: {
      claude: 'Run with Claude',
      scripted: 'Run scripted',
      badge: 'Scripted',
      claudeOff: 'Claude is off',
      claudeReason: CLAUDE_DISABLED_REASON,
    },
    status: { reconnecting: 'Reconnecting', error: 'Stream error' },
    strip: {
      label: 'Payment',
      steps: { required: '402', paid: 'pay', received: '200' },
      state: { idle: 'waiting', done: 'done', stopped: 'stopped' },
    },
    timeline: {
      title: 'Agent timeline',
      empty: 'The agent steps appear here once a run starts.',
      error: 'error',
      decisions: {
        within_budget: 'Within budget',
        per_payment_cap: 'Over the per-payment cap',
        total_cap: 'Over the total cap',
        above_max_amount: 'Above the maximum amount',
      } as Readonly<Record<string, string>>,
      kinds: {
        'llm.reasoning': 'reasoning',
        'llm.tool-call': 'tool call',
        'policy.decision': 'policy',
        'payment.required': '402 quote',
        'payment.signed': 'signed',
        'resource.received': 'response',
        'run.finished': 'finished',
      },
    },
    quote: {
      title: 'Quote',
      empty: 'The quote appears when the run starts.',
      source: 'source',
      rate: 'rate',
      amount: 'ARGt amount',
      price: 'price',
      validUntil: 'valid until',
      guard: 'guarded',
      disclaimer: 'market rate, not official',
    },
    balances: {
      title: 'Balances',
      empty: 'Balances appear once the run starts.',
      agent: 'agent',
      seller: 'seller',
      before: 'before',
      after: 'after',
      change: 'change',
      moved: 'moved',
      pending: 'after the run',
    },
    fork: {
      title: 'Fork transactions',
      label: 'fork',
      empty: 'No transaction yet.',
      kinds: { 'payment.status': 'payment', 'identity.feedback': 'feedback' },
    },
  },
} as const;

export type Demo1Copy = typeof copy.demo1;
