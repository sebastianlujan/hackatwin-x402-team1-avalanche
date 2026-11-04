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
  path: {
    nav: { label: 'Talk path', previous: 'Previous', next: 'Next' },
    screens: {
      avalanche: {
        title: 'Avalanche primer',
        lead: 'One network of networks, and the chain this talk starts on.',
        items: [
          {
            term: 'Primary Network',
            text: 'Three built-in chains: the C-Chain runs EVM smart contracts, the P-Chain tracks validators and L1s, and the X-Chain moves assets.',
          },
          {
            term: 'L1s',
            text: 'A sovereign blockchain with its own validators, token and rules. Demo 2 pays into one.',
          },
          {
            term: 'Avalanche9000 and ACP-77',
            text: 'Launching an L1 no longer needs a Primary Network stake: its validators pay a continuous fee instead.',
          },
        ],
      },
      production: {
        title: 'Production path',
        lead: 'How real ARGt moves across chains.',
        items: [
          {
            term: 'In the demos',
            text: 'No LayerZero code runs here. Demo 1 mints ARGt on a local fork of the C-Chain.',
          },
          {
            term: 'In production',
            text: 'Twin moves ARGt between chains with a LayerZero OFT adapter that holds the minter and burner role.',
          },
          {
            term: 'Next',
            text: 'If Twin deploys official ARGt on Fuji, Demos 2 and 3 switch to it by configuration.',
          },
        ],
      },
      builtByAgents: {
        title: 'Built by agents',
        lead: 'This repository is written by agents, with guard rails.',
        items: [
          {
            term: '.mcp.json',
            text: 'Avalanche docs and read-only chain lookups, plus OpenZeppelin contract scaffolding.',
          },
          {
            term: 'Skills',
            text: 'Avalanche, Chainlink CCIP and Chainlink Data Feeds skills, and the ethskills plugin for x402, ERC-8004, security and testing.',
          },
          {
            term: 'Issue, branch, pull request',
            text: 'Every change starts as an issue, lands on a branch and passes CI in a pull request before it merges.',
          },
        ],
      },
    },
    placeholders: {
      badge: 'Placeholder',
      demo2: { title: 'Demo 2', lead: 'The TwinPay L1 payment is not built yet.', items: [] },
      demo3: { title: 'Demo 3', lead: 'The config switch between chains is not built yet.', items: [] },
      identity: { title: 'Agents with identity', lead: 'The identity card is not built yet.', items: [] },
      firstTx: { title: 'First transaction on Fuji', lead: 'The wallet screen is not built yet.', items: [] },
    },
  },
} as const;

export type Demo1Copy = typeof copy.demo1;
export type PathCopy = typeof copy.path;
export interface TalkScreenCopy {
  readonly title: string;
  readonly lead: string;
  readonly items: readonly { readonly term: string; readonly text: string }[];
}
