import type { Address } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import { createGuardedOracle } from '../src/create-guarded-oracle.ts';

const pool = '0x356D349dA9ADd7Efb56a35fAB939A2c6D852f853' as Address;
const argt = '0x59863989d080B22476DB95656d0C3CC18be92214' as Address;
const usdt0 = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address;
const feed = '0xaf992a6ad37b4878cF9c31f082B178860e268cE3' as Address;
const sequencer = '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433' as Address;
const NOW = 1_800_000_000_000;

describe('createGuardedOracle', () => {
  it('wires both oracles over the two clients and the clock', async () => {
    const arbitrum = new FakeChainClient({
      chainId: 42161,
      blockNumber: 10n,
      reads: {
        [readKey(pool, 'coins', [0n])]: argt,
        [readKey(pool, 'coins', [1n])]: usdt0,
        [readKey(pool, 'price_oracle')]: 1658_360000000000000000n,
      },
    });
    const base = new FakeChainClient({
      chainId: 8453,
      blockNumber: 20n,
      reads: {
        [readKey(feed, 'decimals')]: 8,
        [readKey(feed, 'latestRoundData')]: [1n, 60317n, 0n, BigInt(NOW / 1000 - 60), 1n],
        [readKey(sequencer, 'latestRoundData')]: [1n, 0n, 1n, 1n, 1n],
      },
    });
    const oracle = createGuardedOracle({
      arbitrum,
      base,
      addresses: { curve: { pool, argt, usdt0 }, chainlink: { feed, sequencer, heartbeatSeconds: 86400 } },
      now: () => NOW,
    });
    const reading = await oracle.reading();
    expect(reading.chosen.source).toBe('curve');
    expect(reading.curve.blockNumber).toBe(10n);
    expect(reading.chainlink.blockNumber).toBe(20n);
    expect(reading.deltaBps).toBe(3n);
    expect(reading.validUntil).toBe(NOW + 30_000);
  });
});
