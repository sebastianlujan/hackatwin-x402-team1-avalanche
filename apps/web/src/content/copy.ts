// Every user-facing string lives here; components receive their slice as props.
export const copy = {
  demo1: {
    strip: {
      label: 'Payment',
      steps: { required: '402', paid: 'pay', received: '200' },
      state: { idle: 'waiting', done: 'done', stopped: 'stopped' },
    },
    timeline: {
      title: 'Agent timeline',
      empty: 'The agent steps appear here once a run starts.',
      error: 'error',
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
