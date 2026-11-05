import { loadProfile } from '@hackatwin/config';
import { type AgentEvent, createContainer, encodeAgentEvent, Ports } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { BANNER, findLiveReferences } from '../labels.ts';
import type { Root } from '../root.ts';
import { Tokens } from '../tokens.ts';
import { world } from '../world.fixtures.ts';
import { runDemo2, startDemo2Run } from './entry.ts';
import { hop, RelayedMessenger } from './messenger.fixtures.ts';

const local = loadProfile('local-crosschain', {
  LOCAL_HUB_RPC_URL: 'http://127.0.0.1:18545',
  LOCAL_L1_RPC_URL: 'http://127.0.0.1:18546',
});
const SETTLED = [
  [hop(0, 'None'), hop(1, 'Pending'), hop(2, 'Dispatched', 31337)],
  [hop(3, 'Received', 31338), hop(4, 'Settled', 31338)],
];
const fast = { sleep: async () => undefined, pollMs: 0, maxPolls: 3 };

function fakeRoot(messenger: RelayedMessenger, name = 'local-crosschain'): () => Promise<Root> {
  return async () => {
    const container = createContainer();
    container.register(Tokens.World, () => world);
    container.register(
      Tokens.Hub,
      () => ({ public: { getBlock: async () => ({ timestamp: 1_700_000_000n }) } }) as never,
    );
    container.register(Ports.CrossChainMessenger, () => messenger);
    return { container, profile: { ...local, name } as never };
  };
}
const collect = async (events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> => {
  const all: AgentEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
};

describe('startDemo2Run', () => {
  it('sends exactly one payment and emits the hops through Settled', async () => {
    const messenger = new RelayedMessenger(SETTLED);
    const run = await startDemo2Run({ llm: 'scripted', compose: fakeRoot(messenger), tools: fast });
    const events = await collect(run.events);
    expect(messenger.sent).toHaveLength(1);
    expect(events.flatMap((e) => (e.type === 'hop' ? [e.hop.status] : []))).toEqual([
      'None',
      'Pending',
      'Dispatched',
      'Received',
      'Settled',
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'run.finished',
      reason: 'done',
      message: expect.stringContaining('Settled'),
    });
  });

  it('runs without an API key and names the scripted LLM', async () => {
    const run = await startDemo2Run({ llm: 'scripted', compose: fakeRoot(new RelayedMessenger(SETTLED)), tools: fast });
    expect(local.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect((await collect(run.events))[0]).toMatchObject({
      type: 'run.started',
      llm: 'scripted',
      profile: 'local-crosschain',
    });
  });

  it('marks every event of a local run as simulated', async () => {
    const run = await startDemo2Run({ llm: 'scripted', compose: fakeRoot(new RelayedMessenger(SETTLED)), tools: fast });
    const events = await collect(run.events);
    expect(events.length).toBeGreaterThan(10);
    expect(events.filter((e) => e.simulated !== 'local-crosschain')).toEqual([]);
  });

  it('marks no event of another profile', async () => {
    const compose = fakeRoot(new RelayedMessenger(SETTLED), 'cchain-fork');
    const events = await collect((await startDemo2Run({ llm: 'scripted', compose, tools: fast })).events);
    expect(events.filter((e) => e.simulated !== undefined)).toEqual([]);
  });

  it('ends the run, not the process, when the payment is rejected', async () => {
    const rejected = [[hop(0, 'None'), { ...hop(1, 'Rejected'), reason: 'PaymentBroker_PayerMismatch' }]];
    const run = await startDemo2Run({
      llm: 'scripted',
      compose: fakeRoot(new RelayedMessenger(rejected)),
      tools: fast,
    });
    expect((await collect(run.events)).at(-1)).toMatchObject({
      reason: 'done',
      message: expect.stringContaining('PaymentBroker_PayerMismatch'),
    });
  });
});

describe('runDemo2', () => {
  const play = async (messenger = new RelayedMessenger(SETTLED)) => {
    const lines: string[] = [];
    const code = await runDemo2({ llm: 'scripted', compose: fakeRoot(messenger), tools: fast }, (line) =>
      lines.push(line),
    );
    return { lines, code };
  };

  it('prints the banner first, then one line per event', async () => {
    const { lines, code } = await play();
    expect(code).toBe(0);
    expect(lines[0]).toBe(BANNER);
    expect(lines[1]).toBe('run started: agent payer, profile local-crosschain, llm scripted');
    expect(lines).toContain(`hop 4: local Settled on chain 31338 tx ${hop(4, 'Settled').txHash}`);
    expect(lines).toContain('policy decision: allowed 1.00 USD (within_budget)');
  });

  it('prints the banner first even when the run cannot start', async () => {
    const lines: string[] = [];
    const compose = async () => {
      throw new Error('no world');
    };
    await expect(runDemo2({ llm: 'scripted', compose }, (line) => lines.push(line))).rejects.toThrow('no world');
    expect(lines).toEqual([BANNER]);
  });

  it('shows no Sepolia, CCIP Explorer, Snowtrace or https text in the output or the events', async () => {
    const messenger = new RelayedMessenger(SETTLED);
    const { lines } = await play(messenger);
    const run = await startDemo2Run({ llm: 'scripted', compose: fakeRoot(new RelayedMessenger(SETTLED)), tools: fast });
    const events = (await collect(run.events)).map(encodeAgentEvent);
    expect(lines.length).toBeGreaterThan(10);
    expect(findLiveReferences([...lines, ...events].join('\n'))).toEqual([]);
  });
});
