import { describe, expect, it } from 'vitest';
import { createContainer } from '../container.ts';
import { type Address, type Hex, money } from '../domain/money.ts';
import type { LlmReply } from '../ports/llm.ts';
import { Ports } from '../ports/tokens.ts';
import {
  FakeAgentIdentity,
  FakeAgentPolicy,
  FakeChainClient,
  FakeCrossChainMessenger,
  FakePaymentGateway,
  FakePriceOracle,
  ScriptedLLM,
} from './index.ts';

const addr = `0x${'1'.repeat(40)}` as Address;
const usd = (units: bigint) => money(units, 6, 'USD');
const reply = (text: string): LlmReply => ({ content: [{ type: 'text', text }], stopReason: 'end_turn' });
const llmRequest = { system: 's', messages: [], tools: [] };

describe('ScriptedLLM', () => {
  it('replays replies in order and records requests', async () => {
    const llm = new ScriptedLLM([reply('one'), reply('two')]);
    expect((await llm.complete(llmRequest)).content).toEqual([{ type: 'text', text: 'one' }]);
    expect((await llm.complete(llmRequest)).content).toEqual([{ type: 'text', text: 'two' }]);
    expect(llm.requests).toHaveLength(2);
  });

  it('throws when the script is exhausted', async () => {
    await expect(new ScriptedLLM([]).complete(llmRequest)).rejects.toThrow(/no scripted reply/);
  });
});

describe('FakePaymentGateway', () => {
  const request = { url: 'https://x', method: 'GET' as const, maxAmount: usd(1n) };

  it('replays responses and records requests', async () => {
    const gateway = new FakePaymentGateway([{ status: 200, body: 'ok' }]);
    expect((await gateway.pay(request)).body).toBe('ok');
    expect(gateway.requests).toEqual([request]);
  });

  it('throws when exhausted', async () => {
    await expect(new FakePaymentGateway([]).pay(request)).rejects.toThrow(/no scripted response/);
  });
});

describe('FakeAgentIdentity', () => {
  it('issues sequential ids from 1 and sequential feedback hashes', async () => {
    const identity = new FakeAgentIdentity();
    expect(await identity.register('uri:a')).toBe(1n);
    expect(await identity.register('uri:b')).toBe(2n);
    const feedback = { agentId: 1n, value: 5n, valueDecimals: 2, tag1: 't', tag2: '' };
    expect(await identity.giveFeedback(feedback)).toBe(`0x${'1'.padStart(64, '0')}`);
    expect(await identity.giveFeedback(feedback)).toBe(`0x${'2'.padStart(64, '0')}`);
  });

  it('feeds stored feedback into reputation', async () => {
    const identity = new FakeAgentIdentity();
    await identity.register('uri:a');
    await identity.giveFeedback({ agentId: 1n, value: 5n, valueDecimals: 2, tag1: '', tag2: '' });
    await identity.giveFeedback({ agentId: 1n, value: 3n, valueDecimals: 2, tag1: '', tag2: '' });
    expect(await identity.reputation(1n)).toEqual({ agentId: 1n, count: 2n, value: 8n, valueDecimals: 2 });
    expect(await identity.reputation(9n)).toEqual({ agentId: 9n, count: 0n, value: 0n, valueDecimals: 0 });
  });

  it('rejects feedback for an unknown agent', async () => {
    const feedback = { agentId: 7n, value: 1n, valueDecimals: 0, tag1: '', tag2: '' };
    await expect(new FakeAgentIdentity().giveFeedback(feedback)).rejects.toThrow(/Unknown agent 7/);
  });
});

describe('FakeAgentPolicy', () => {
  it('allows by default and records calls', async () => {
    const policy = new FakeAgentPolicy();
    expect(await policy.authorize(usd(1n))).toEqual({ allowed: true, reason: 'allowed' });
    await policy.record(usd(1n));
    expect(policy.authorized).toEqual([usd(1n)]);
    expect(policy.recorded).toEqual([usd(1n)]);
  });

  it('uses an injected decision function', async () => {
    const policy = new FakeAgentPolicy((m) => ({ allowed: m.units < 10n, reason: 'cap' }));
    expect((await policy.authorize(usd(11n))).allowed).toBe(false);
  });
});

describe('FakeChainClient', () => {
  const call = { address: addr, abi: [], functionName: 'balanceOf', args: [addr] };
  const key = `${addr}:balanceOf(${addr})`;

  it('reads from the address:fn(args) script and reports the head block', async () => {
    const chain = new FakeChainClient({ blockNumber: 9n, reads: { [key]: 42n } });
    expect(await chain.read<bigint>(call)).toEqual({ value: 42n, blockNumber: 9n });
    expect(await chain.blockNumber()).toBe(9n);
    expect(chain.chainId).toBe(31337);
  });

  it('separates the same function with different args and keeps bigint args exact', async () => {
    const other = `0x${'2'.repeat(40)}` as Address;
    const chain = new FakeChainClient({
      reads: { [key]: 1n, [`${addr}:balanceOf(${other})`]: 2n, [`${addr}:at(12345678901234567890)`]: 3n },
    });
    expect((await chain.read<bigint>({ ...call, args: [other] })).value).toBe(2n);
    expect((await chain.read<bigint>(call)).value).toBe(1n);
    expect((await chain.read<bigint>({ ...call, functionName: 'at', args: [12345678901234567890n] })).value).toBe(3n);
  });

  it('rejects an Error value and an unscripted call naming address, function and args', async () => {
    const chain = new FakeChainClient({ reads: { [key]: new Error('boom') } });
    await expect(chain.read(call)).rejects.toThrow('boom');
    const miss = chain.read({ ...call, functionName: 'other', args: [5n, 'x'] });
    await expect(miss).rejects.toThrow(`${addr}:other(5,x)`);
    await expect(miss).rejects.toThrow(/address 0x1+, function other/);
  });

  it('records the requested block and echoes a pinned one', async () => {
    const chain = new FakeChainClient({ blockNumber: 9n, reads: { [key]: 42n } });
    expect((await chain.read(call, { blockNumber: 5n })).blockNumber).toBe(5n);
    await chain.read(call);
    expect(chain.calls.map((c) => c.blockNumber)).toEqual([5n, undefined]);
  });

  it('issues sequential tx hashes and scripted receipt logs', async () => {
    const log = { address: addr, topics: [] as Hex[], data: '0x' as Hex };
    const chain = new FakeChainClient({ chainId: 43113, logs: [log] });
    const first = await chain.write(call);
    const second = await chain.write(call);
    expect([first, second]).toEqual([`0x${'1'.padStart(64, '0')}`, `0x${'2'.padStart(64, '0')}`]);
    expect(chain.chainId).toBe(43113);
    expect(await chain.waitForReceipt(second)).toMatchObject({ status: 'success', blockNumber: 2n, logs: [log] });
    await expect(chain.waitForReceipt(`0x${'9'.padStart(64, '0')}`)).rejects.toThrow(/Unknown transaction/);
  });
});

describe('FakePriceOracle', () => {
  it('converts with the fixed rate and the injected clock', async () => {
    let now = 1_000;
    const oracle = new FakePriceOracle(usd(2_000_000n), () => now);
    const quote = await oracle.quote(usd(1_000_000n), 'ARGt');
    expect(quote.amount).toEqual(money(500_000_000_000_000_000n, 18, 'ARGt'));
    expect(quote.validUntil).toBe(61_000);
    now = 5_000;
    expect((await new FakePriceOracle(usd(1_000_000n), () => now, 10).quote(usd(1n), 'USDC')).validUntil).toBe(5_010);
  });
});

describe('FakeCrossChainMessenger', () => {
  it('issues sequential message ids and tracks scripted hops', async () => {
    const hop = {
      index: 0,
      transport: 'local' as const,
      chainId: 1,
      status: 'Settled' as const,
      txHash: '0x00' as Hex,
      explorerUrl: 'u',
    };
    const messenger = new FakeCrossChainMessenger([hop]);
    const transfer = { destinationChainId: 2, recipient: addr, amount: usd(1n) };
    expect(await messenger.send(transfer)).toBe('message-1');
    expect(await messenger.send(transfer)).toBe('message-2');
    const seen = [];
    for await (const h of messenger.track('message-1')) seen.push(h);
    expect(seen).toEqual([hop]);
    const none = [];
    for await (const h of new FakeCrossChainMessenger().track('m')) none.push(h);
    expect(none).toEqual([]);
  });
});

describe('container swap', () => {
  it('swaps a fake into a child scope without touching the parent', async () => {
    const root = createContainer();
    root.register(Ports.LLM, () => new ScriptedLLM([reply('real')]));
    const child = root.child();
    child.register(Ports.LLM, () => new ScriptedLLM([reply('fake')]));
    expect((await child.resolve(Ports.LLM).complete(llmRequest)).content).toEqual([{ type: 'text', text: 'fake' }]);
    expect((await root.resolve(Ports.LLM).complete(llmRequest)).content).toEqual([{ type: 'text', text: 'real' }]);
  });
});
