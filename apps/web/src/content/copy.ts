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
  },
} as const;

export type Demo1Copy = typeof copy.demo1;
