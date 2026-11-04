import { type AgentEvent, parseMoney } from '@hackatwin/core';
import { FakePriceOracle } from '@hackatwin/core/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { argtPerUsd, createWorld, type ForkNode, RATE, startForkNode, type World } from './support/fork-setup.ts';

let node: ForkNode;
let snapshot: `0x${string}`;
let world: World | undefined;

beforeAll(async () => {
  node = await startForkNode();
});

afterAll(async () => {
  await node.stop();
});

beforeEach(async () => {
  snapshot = await node.fork.cheats().snapshot();
});

afterEach(async () => {
  await world?.close();
  world = undefined;
  await node.fork.cheats().revert(snapshot);
});

const of = <T extends AgentEvent['type']>(events: AgentEvent[], type: T) =>
  events.filter((event): event is Extract<AgentEvent, { type: T }> => event.type === type);

describe('Demo 1 protocol on the pinned fork, scripted LLM', () => {
  it('pays 402 to 200, moves exactly the quote and rates the seller once', async () => {
    world = await createWorld(node.fork);
    const before = await world.balances();
    const events = await world.run();
    const after = await world.balances();

    const quote = (await new FakePriceOracle(RATE, Date.now).quote(parseMoney('0.01', 6, 'USD'), 'ARGt')).amount.units;
    expect(events[0]).toMatchObject({ type: 'run.started', llm: 'scripted' });
    expect(events.at(-1)).toMatchObject({ type: 'run.finished', reason: 'done' });
    expect(of(events, 'payment.required')).toHaveLength(1);
    expect(of(events, 'policy.decision')).toMatchObject([{ allowed: true, reason: 'within_budget' }]);
    expect(of(events, 'payment.signed')).toHaveLength(1);
    expect(of(events, 'payment.status')).toMatchObject([{ from: 'Pending', to: 'Settled' }]);
    expect(of(events, 'resource.received')).toMatchObject([{ status: 200 }]);
    expect(after.seller - before.seller).toBe(quote);
    expect(before.agent - after.agent).toBe(quote);

    const feedback = of(events, 'identity.feedback');
    expect(feedback).toHaveLength(1);
    expect(feedback[0]?.agentId).toBe(world.ids.seller);
    expect((await world.reputation(world.ids.seller)).count).toBe(1n);
  });

  it('refuses an ask above the ceiling, signs nothing and moves nothing', async () => {
    world = await createWorld(node.fork, { sellerRate: argtPerUsd(100_000_000n) });
    const before = await world.balances();
    const events = await world.run();
    const after = await world.balances();

    expect(of(events, 'policy.decision')).toMatchObject([{ allowed: false, reason: 'above_max_amount' }]);
    expect(of(events, 'payment.signed')).toEqual([]);
    expect(of(events, 'identity.feedback')).toEqual([]);
    expect(after).toEqual(before);
    expect((await world.reputation(world.ids.seller)).count).toBe(0n);
  });
});
