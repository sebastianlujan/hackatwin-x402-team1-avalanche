import { type AgentEvent, type CrossChainMessenger, money } from '@hackatwin/core';
import { FakeAgentPolicy, FakeCrossChainMessenger } from '@hackatwin/core/testing';
import { decodeAbiParameters } from 'viem';
import { describe, expect, it } from 'vitest';
import { a, world } from '../world.fixtures.ts';
import { hop, RelayedMessenger } from './messenger.fixtures.ts';
import { createPaymentTools } from './tools.ts';

const AMOUNT = money(1_000_000n, 6, 'USD');
const NOW = 1_700_000_000n;
function setup(messenger: CrossChainMessenger, policy = new FakeAgentPolicy(), maxPolls = 5) {
  const events: AgentEvent[] = [];
  const sleeps: number[] = [];
  const tools = createPaymentTools({
    messenger,
    world,
    amount: AMOUNT,
    chainTime: async () => NOW,
    sleep: async (ms) => void sleeps.push(ms),
    pollMs: 250,
    maxPolls,
    now: () => 7,
  });
  const context = { emit: (event: AgentEvent) => void events.push(event), policy };
  const run = (name: string) => (tools.find((tool) => tool.name === name) as never as Run).run({} as never, context);
  return { run, events, sleeps, policy };
}
interface Run {
  run(input: never, context: { emit: (event: AgentEvent) => void; policy: FakeAgentPolicy }): Promise<string>;
}

describe('send_payment', () => {
  it('authorizes the profile amount, sends one message to the broker and records it', async () => {
    const messenger = new FakeCrossChainMessenger();
    const { run, policy } = setup(messenger);
    await expect(run('send_payment')).resolves.toContain('message-1');
    expect(policy.authorized).toEqual([AMOUNT]);
    expect(policy.recorded).toEqual([AMOUNT]);
    const [sent] = messenger.sent;
    expect(sent).toMatchObject({ destinationChainId: 31338, recipient: a(3), amount: AMOUNT });
    const [, payer, amount, deadline] = decodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
      sent?.payload ?? '0x',
    );
    expect([payer, amount, deadline]).toEqual([BigInt(a(7)), 1_000_000n, NOW + 3600n]);
  });

  it('refuses a second payment in the same run', async () => {
    const messenger = new FakeCrossChainMessenger();
    const { run } = setup(messenger);
    await run('send_payment');
    await expect(run('send_payment')).rejects.toThrow('already sent');
    expect(messenger.sent).toHaveLength(1);
  });

  it('sends nothing when the policy refuses', async () => {
    const messenger = new FakeCrossChainMessenger();
    const { run } = setup(messenger, new FakeAgentPolicy(() => ({ allowed: false, reason: 'total_cap' })));
    await expect(run('send_payment')).rejects.toThrow('total_cap');
    expect(messenger.sent).toHaveLength(0);
  });
});

describe('track_payment', () => {
  it('needs a payment first', async () => {
    await expect(setup(new FakeCrossChainMessenger()).run('track_payment')).rejects.toThrow('no payment');
  });

  it('polls until Settled and emits each hop once, in order', async () => {
    const messenger = new RelayedMessenger([[hop(0, 'None'), hop(1, 'Pending')], [], [hop(2, 'Settled')]]);
    const { run, events, sleeps } = setup(messenger);
    await run('send_payment');
    await expect(run('track_payment')).resolves.toContain('Settled');
    expect(events.map((e) => (e.type === 'hop' ? [e.messageId, e.hop.index, e.at] : e.type))).toEqual([
      ['message-1', 0, 7],
      ['message-1', 1, 7],
      ['message-1', 2, 7],
    ]);
    expect(sleeps).toEqual([250, 250]);
  });

  it('ends on Rejected with the reason the contract gave', async () => {
    const rejected = { ...hop(1, 'Rejected'), reason: 'PaymentBroker_PayerMismatch' };
    const { run, sleeps } = setup(new RelayedMessenger([[hop(0, 'None')], [rejected]]));
    await run('send_payment');
    await expect(run('track_payment')).resolves.toMatch(/Rejected.*PaymentBroker_PayerMismatch/);
    expect(sleeps).toEqual([250]);
  });

  it('fails when no terminal status arrives within the polls', async () => {
    const { run, sleeps } = setup(new RelayedMessenger([[hop(0, 'None')], []]), undefined, 3);
    await run('send_payment');
    await expect(run('track_payment')).rejects.toThrow(/None.*relay/);
    expect(sleeps).toHaveLength(2);
  });
});
