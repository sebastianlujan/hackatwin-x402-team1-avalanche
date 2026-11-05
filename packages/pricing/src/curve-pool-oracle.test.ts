import type { Address } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import { CurvePoolOracle } from './curve-pool-oracle.ts';

const pool = '0x356D349dA9ADd7Efb56a35fAB939A2c6D852f853' as Address;
const argt = '0x59863989d080B22476DB95656d0C3CC18be92214' as Address;
const usdt0 = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address;
const other = '0x0000000000000000000000000000000000000001' as Address;

const oracle = (coins: [Address, Address], price: unknown = 1658_360000000000000000n) =>
  new CurvePoolOracle(
    new FakeChainClient({
      chainId: 42161,
      blockNumber: 777n,
      reads: {
        [readKey(pool, 'coins', [0n])]: coins[0],
        [readKey(pool, 'coins', [1n])]: coins[1],
        [readKey(pool, 'price_oracle')]: price,
      },
    }),
    { pool, argt, usdt0 },
  );

describe('CurvePoolOracle', () => {
  it('returns ARGt per USD at one block', async () => {
    expect(await oracle([argt, usdt0]).reading()).toEqual({
      source: 'curve',
      argtPerUsd: 1658_360000000000000000n,
      chainId: 42161,
      blockNumber: 777n,
    });
  });

  it('pins every read to the same block and passes no args to price_oracle', async () => {
    const client = new FakeChainClient({
      blockNumber: 9n,
      reads: {
        [readKey(pool, 'coins', [0n])]: argt,
        [readKey(pool, 'coins', [1n])]: usdt0,
        [readKey(pool, 'price_oracle')]: 1n,
      },
    });
    await new CurvePoolOracle(client, { pool, argt, usdt0 }).reading();
    expect(client.calls.map((c) => c.blockNumber)).toEqual([9n, 9n, 9n]);
    expect(client.calls.find((c) => c.call.functionName === 'price_oracle')?.call.args).toEqual([]);
  });

  it('compares coins without regard to address case', async () => {
    const lower = argt.toLowerCase() as Address;
    expect((await oracle([lower, usdt0]).reading()).source).toBe('curve');
  });

  it('throws naming coins(0) when it is not ARGt', async () => {
    await expect(oracle([other, usdt0]).reading()).rejects.toThrow(`coins(0) is ${other}, expected ARGt ${argt}`);
  });

  it('throws naming coins(1) when it is not USD₮0', async () => {
    await expect(oracle([argt, other]).reading()).rejects.toThrow(`coins(1) is ${other}, expected USD₮0 ${usdt0}`);
  });

  it('propagates a failing read', async () => {
    await expect(oracle([argt, usdt0], new Error('rpc down')).reading()).rejects.toThrow('rpc down');
  });
});
