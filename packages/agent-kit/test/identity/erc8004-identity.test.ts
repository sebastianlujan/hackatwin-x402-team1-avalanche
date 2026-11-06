import type { Address, Log } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { encodeAbiParameters, encodeEventTopics } from 'viem';
import { describe, expect, it } from 'vitest';
import { identityAbi, reputationAbi } from '../../src/identity/abi.ts';
import { Erc8004Identity } from '../../src/identity/erc8004-identity.ts';
import { IdentityTransactionError, RegisteredEventMissingError, SelfFeedbackError } from '../../src/identity/errors.ts';

const IDENTITY: Address = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REPUTATION: Address = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
const BUYER: Address = '0x7Ea1e5EF86548a506C81085099b356fD0B7B9EFC';
const SELLER: Address = '0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5';

const registered = (agentId: bigint, address: Address = IDENTITY): Log => ({
  address,
  topics: encodeEventTopics({
    abi: identityAbi,
    eventName: 'Registered',
    args: { agentId, owner: BUYER },
  }) as Log['topics'],
  data: encodeAbiParameters([{ type: 'string' }], ['data:application/json;base64,e30=']),
});

const adapter = (chain: FakeChainClient) =>
  new Erc8004Identity({ chain, identity: IDENTITY, reputation: REPUTATION, signer: BUYER });
const owns = (value: boolean, agentId = 7n) => ({
  [readKey(IDENTITY, 'isAuthorizedOrOwner', [BUYER, agentId])]: value,
});

describe('Erc8004Identity.register', () => {
  it('returns the agentId of the Registered event and sends register(agentURI)', async () => {
    const chain = new FakeChainClient({ logs: [registered(42n)] });
    expect(await adapter(chain).register('ipfs://x')).toBe(42n);
    expect(chain.writes).toEqual([
      { address: IDENTITY, abi: identityAbi, functionName: 'register', args: ['ipfs://x'] },
    ]);
  });

  it('ignores Registered logs from other contracts', async () => {
    const chain = new FakeChainClient({ logs: [registered(1n, SELLER), registered(2n)] });
    expect(await adapter(chain).register('ipfs://x')).toBe(2n);
  });

  it('throws a typed error when the receipt has no Registered event', async () => {
    const other: Log = { address: IDENTITY, topics: ['0x'.padEnd(66, '1') as `0x${string}`], data: '0x' };
    await expect(adapter(new FakeChainClient({ logs: [other] })).register('x')).rejects.toBeInstanceOf(
      RegisteredEventMissingError,
    );
    await expect(adapter(new FakeChainClient()).register('x')).rejects.toBeInstanceOf(RegisteredEventMissingError);
  });

  it('throws when the transaction reverted', async () => {
    const chain = new FakeChainClient({ logs: [registered(1n)] });
    chain.waitForReceipt = async (txHash) => ({ txHash, status: 'reverted', blockNumber: 1n, logs: [] });
    await expect(adapter(chain).register('x')).rejects.toBeInstanceOf(IdentityTransactionError);
  });
});

describe('Erc8004Identity.giveFeedback', () => {
  it('sends the verified 8-argument call and returns the transaction hash', async () => {
    const chain = new FakeChainClient({ reads: owns(false) });
    const hash = await adapter(chain).giveFeedback({
      agentId: 7n,
      value: 1n,
      valueDecimals: 0,
      tag1: 'x402',
      tag2: 'fx-quote',
    });
    expect(hash).toBe(`0x${'1'.padStart(64, '0')}`);
    expect(chain.writes).toEqual([
      {
        address: REPUTATION,
        abi: reputationAbi,
        functionName: 'giveFeedback',
        args: [7n, 1n, 0, 'x402', 'fx-quote', '', '', `0x${'0'.repeat(64)}`],
      },
    ]);
  });

  it('throws SelfFeedbackError and sends nothing when the signer owns or operates the agent', async () => {
    const chain = new FakeChainClient({ reads: owns(true) });
    const failure = await adapter(chain)
      .giveFeedback({ agentId: 7n, value: 1n, valueDecimals: 0, tag1: 'x402', tag2: 'fx-quote' })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SelfFeedbackError);
    expect(failure).toMatchObject({ agentId: 7n });
    expect(chain.writes).toEqual([]);
  });
});

describe('Erc8004Identity.reputation', () => {
  it('answers count 0 without reading the summary when there are no clients', async () => {
    const chain = new FakeChainClient({ reads: { [readKey(REPUTATION, 'getClients', [7n])]: [] } });
    expect(await adapter(chain).reputation(7n)).toEqual({ agentId: 7n, count: 0n, value: 0n, valueDecimals: 0 });
    expect(chain.calls).toHaveLength(1);
  });

  it('reads getClients then getSummary over those clients with empty tags', async () => {
    const reads = {
      [readKey(REPUTATION, 'getClients', [7n])]: [BUYER],
      [readKey(REPUTATION, 'getSummary', [7n, [BUYER], '', ''])]: [1n, 1n, 0],
    };
    const chain = new FakeChainClient({ reads });
    expect(await adapter(chain).reputation(7n)).toEqual({ agentId: 7n, count: 1n, value: 1n, valueDecimals: 0 });
  });
});

describe('Erc8004Identity.ownerOf', () => {
  it('reads the owner of an agent', async () => {
    const chain = new FakeChainClient({ reads: { [readKey(IDENTITY, 'ownerOf', [7n])]: SELLER } });
    expect(await adapter(chain).ownerOf(7n)).toBe(SELLER);
  });
});
