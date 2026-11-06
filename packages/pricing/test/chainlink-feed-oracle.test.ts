import type { Address } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import { ChainlinkFeedOracle } from '../src/chainlink-feed-oracle.ts';

const feed = '0xaf992a6ad37b4878cF9c31f082B178860e268cE3' as Address;
const sequencer = '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433' as Address;
const NOW = 1_800_000_000;
const HOUR = 3600;

interface Setup {
  decimals?: number;
  answer?: bigint;
  updatedAgo?: number;
  sequencerAnswer?: bigint;
  startedAgo?: number;
  startedAt?: number;
}

const oracle = (s: Setup = {}) => {
  const updatedAt = BigInt(NOW - (s.updatedAgo ?? HOUR));
  const startedAt = BigInt(s.startedAt ?? NOW - (s.startedAgo ?? 10 * HOUR));
  const client = new FakeChainClient({
    chainId: 8453,
    blockNumber: 4242n,
    reads: {
      [readKey(feed, 'decimals')]: s.decimals ?? 8,
      [readKey(feed, 'latestRoundData')]: [1n, s.answer ?? 60317n, 0n, updatedAt, 1n],
      [readKey(sequencer, 'latestRoundData')]: [1n, s.sequencerAnswer ?? 0n, startedAt, startedAt, 1n],
    },
  });
  return new ChainlinkFeedOracle(client, { feed, sequencer, heartbeatSeconds: 86400 }, () => NOW * 1000);
};

describe('ChainlinkFeedOracle', () => {
  it('inverts a fresh round into ARGt per USD at one block', async () => {
    const reading = await oracle().reading();
    expect(reading).toEqual({
      source: 'chainlink',
      argtPerUsd: 10n ** 26n / 60317n,
      chainId: 8453,
      blockNumber: 4242n,
    });
    expect(Number(reading.argtPerUsd) / 1e18).toBeCloseTo(1657.9, 1);
  });

  it('reads decimals at runtime', async () => {
    expect((await oracle({ decimals: 6, answer: 603n }).reading()).argtPerUsd).toBe(10n ** 24n / 603n);
  });

  it('pins every read to the same block', async () => {
    const client = new FakeChainClient({
      blockNumber: 5n,
      reads: {
        [readKey(feed, 'decimals')]: 8,
        [readKey(feed, 'latestRoundData')]: [1n, 60317n, 0n, BigInt(NOW), 1n],
        [readKey(sequencer, 'latestRoundData')]: [1n, 0n, 1n, 1n, 1n],
      },
    });
    await new ChainlinkFeedOracle(client, { feed, sequencer, heartbeatSeconds: 86400 }, () => NOW * 1000).reading();
    expect(client.calls.map((c) => c.blockNumber)).toEqual([5n, 5n, 5n]);
  });

  it('accepts a round exactly at the heartbeat and rejects one second older', async () => {
    expect((await oracle({ updatedAgo: 86400 }).reading()).source).toBe('chainlink');
    await expect(oracle({ updatedAgo: 86401 }).reading()).rejects.toThrow('stale');
  });

  it('rejects a stale round', async () => {
    await expect(oracle({ updatedAgo: 2 * 86400 }).reading()).rejects.toThrow('round is stale');
  });

  it('rejects an updatedAt of 0', async () => {
    await expect(oracle({ updatedAgo: NOW }).reading()).rejects.toThrow('stale');
  });

  it('rejects when the sequencer is down', async () => {
    await expect(oracle({ sequencerAnswer: 1n }).reading()).rejects.toThrow('sequencer is down');
  });

  it('enforces the grace period: 3599 s rejected, 3600 s accepted', async () => {
    await expect(oracle({ startedAgo: 3599 }).reading()).rejects.toThrow('grace period');
    expect((await oracle({ startedAgo: 3600 }).reading()).source).toBe('chainlink');
  });

  it('rejects an unreadable sequencer round (startedAt 0)', async () => {
    await expect(oracle({ startedAt: 0 }).reading()).rejects.toThrow('unreadable');
  });

  it('rejects a zero or negative answer', async () => {
    await expect(oracle({ answer: 0n }).reading()).rejects.toThrow('must be positive');
    await expect(oracle({ answer: -5n }).reading()).rejects.toThrow('must be positive');
  });
});
