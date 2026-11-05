import { readFileSync } from 'node:fs';
import { type Address, type Hex, money } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { encodeAbiParameters, encodeEventTopics, pad, parseAbi } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extraArgsV3 } from './extra-args.ts';
import { LocalCcipSender } from './sender.ts';

const router = `0x${'a'.repeat(40)}` as Address;
const broker = `0x${'b'.repeat(40)}` as Address;
const other = `0x${'c'.repeat(40)}` as Address;
const SELECTOR = 14767482510784806043n;
const GAS = 200_000;
const FEE = 12_345n;
const MESSAGE_ID = `0x${'7'.repeat(64)}` as Hex;
const payload = '0x1234' as Hex;
const transfer = { destinationChainId: 43113, recipient: broker, amount: money(5n, 6, 'USDC'), payload };

const routerAbi = parseAbi([
  'event MessageExecuted(bytes32 messageId, uint64 sourceChainSelector, address offRamp, bytes32 calldataHash)',
]);
const executed = (address: Address) => ({
  address,
  topics: encodeEventTopics({ abi: routerAbi, eventName: 'MessageExecuted' }) as Hex[],
  data: encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint64' }, { type: 'address' }, { type: 'bytes32' }],
    [MESSAGE_ID, 1n, other, `0x${'0'.repeat(64)}`],
  ),
});
const message = {
  receiver: pad(broker),
  data: payload,
  tokenAmounts: [],
  feeToken: '0x0000000000000000000000000000000000000000',
  extraArgs: `0xa69dd4aa${GAS.toString(16).padStart(8, '0')}${'00'.repeat(11)}`,
};
const lanes = { 43113: SELECTOR };

class OrderedClient extends FakeChainClient {
  readonly order: string[] = [];
  override async read<T>(...args: Parameters<FakeChainClient['read']>) {
    this.order.push(args[0].functionName);
    return super.read<T>(...args);
  }
  override async write(call: Parameters<FakeChainClient['write']>[0]) {
    this.order.push(call.functionName);
    return super.write(call);
  }
}
const scripted = (supported = true) => ({
  [readKey(router, 'isChainSupported', [SELECTOR])]: supported,
  [readKey(router, 'getFee', [SELECTOR, message])]: FEE,
});
const sender = (client: FakeChainClient) => new LocalCcipSender({ client, router, lanes, gasLimit: GAS });

afterEach(() => vi.restoreAllMocks());

describe('LocalCcipSender', () => {
  it('Happy path: checks the lane, quotes the fee, then sends and returns the message ID', async () => {
    const client = new OrderedClient({ reads: scripted(), logs: [executed(other), executed(router)] });
    await expect(sender(client).send(transfer)).resolves.toBe(MESSAGE_ID);
    expect(client.order).toEqual(['isChainSupported', 'getFee', 'ccipSend']);
    expect(client.writes[0]).toMatchObject({ address: router, args: [SELECTOR, message] });
  });

  it('Fee paid: sends the quoted native fee as the call value', async () => {
    const client = new FakeChainClient({ reads: scripted(), logs: [executed(router)] });
    await sender(client).send(transfer);
    expect(client.writes[0]?.value).toBe(FEE);
  });

  it('Unsupported: throws naming the selector and calls nothing else', async () => {
    const client = new FakeChainClient({ reads: scripted(false) });
    await expect(sender(client).send(transfer)).rejects.toThrow(String(SELECTOR));
    expect(client.calls.map((c) => c.call.functionName)).toEqual(['isChainSupported']);
    expect(client.writes).toEqual([]);
  });

  it('Fake client: runs with no network', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await sender(new FakeChainClient({ reads: scripted(), logs: [executed(router)] })).send(transfer);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Unscripted call: the fake names address, function and args', async () => {
    const client = new FakeChainClient({ reads: { [readKey(router, 'isChainSupported', [SELECTOR])]: true } });
    const failure = sender(client).send(transfer);
    await expect(failure).rejects.toThrow(router);
    await expect(failure).rejects.toThrow('getFee');
    expect(client.writes).toEqual([]);
  });

  it('Transport: is local and makes no HTTP request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const local = sender(new FakeChainClient({ reads: scripted(), logs: [executed(router)] }));
    await local.send(transfer);
    expect(local.transport).toBe('local');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a destination with no lane and a send that reverts', async () => {
    const client = new FakeChainClient({ reads: scripted() });
    await expect(sender(client).send({ ...transfer, destinationChainId: 1 })).rejects.toThrow('chain ID 1');
    await expect(sender(client).send(transfer)).rejects.toThrow('MessageExecuted');
    expect(client.calls.length).toBe(2);
  });

  it('encodes extra args V3 as tag, gas limit, finality and zero padding', () => {
    expect(extraArgsV3(GAS)).toBe(message.extraArgs);
  });

  it('holds no function selector literal in the source', () => {
    const source = readFileSync(new URL('./sender.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/0x[0-9a-fA-F]{8}\b/);
  });
});
