import { parseMoney } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { GuardedOracle } from '../src/guarded-oracle.ts';
import type { RateReading, RateSource } from '../src/rate-reading.ts';

const LINK = 1_000_000n;

class Source implements RateSource {
  reads = 0;
  private rate: bigint | Error;
  private readonly kind: RateReading['source'];
  constructor(rate: bigint | Error, kind: RateReading['source']) {
    this.rate = rate;
    this.kind = kind;
  }
  set(rate: bigint | Error): void {
    this.rate = rate;
  }
  async reading(): Promise<RateReading> {
    this.reads += 1;
    if (this.rate instanceof Error) throw this.rate;
    return { source: this.kind, argtPerUsd: this.rate, chainId: 1, blockNumber: BigInt(this.reads) };
  }
}

const setup = (curve: bigint | Error, chainlink: bigint | Error = LINK) => {
  const clock = { t: 0 };
  const c = new Source(curve, 'curve');
  const l = new Source(chainlink, 'chainlink');
  return { c, l, clock, oracle: new GuardedOracle(c, l, () => clock.t) };
};

describe('GuardedOracle band', () => {
  it.each([
    ['exactly +2%', 1_020_000n],
    ['exactly -2%', 980_000n],
    ['equal', LINK],
  ])('uses Curve at %s', async (_, curve) => {
    const r = await setup(curve).oracle.reading();
    expect(r.guarded).toBe(false);
    expect(r.chosen.source).toBe('curve');
  });

  it.each([
    ['one unit above +2%', 1_020_001n],
    ['one unit below -2%', 979_999n],
  ])('uses Chainlink flagged guarded at %s', async (_, curve) => {
    const r = await setup(curve).oracle.reading();
    expect(r.guarded).toBe(true);
    expect(r.chosen.source).toBe('chainlink');
    expect(r.curve.argtPerUsd).toBe(curve);
  });

  it('reports the absolute delta in basis points', async () => {
    expect((await setup(1_020_000n).oracle.reading()).deltaBps).toBe(200n);
    expect((await setup(980_000n).oracle.reading()).deltaBps).toBe(200n);
    expect((await setup(1_000_240n).oracle.reading()).deltaBps).toBe(2n);
  });

  it('throws when either source fails', async () => {
    await expect(setup(new Error('curve down')).oracle.reading()).rejects.toThrow('curve down');
    await expect(setup(LINK, new Error('stale')).oracle.reading()).rejects.toThrow('stale');
  });
});

describe('GuardedOracle freeze', () => {
  it('reuses the reading at 29 s and re-reads at 30 s', async () => {
    const { oracle, c, l, clock } = setup(LINK);
    const first = await oracle.reading();
    expect(first.validUntil).toBe(30_000);
    clock.t = 29_000;
    expect(await oracle.reading()).toBe(first);
    expect([c.reads, l.reads]).toEqual([1, 1]);
    clock.t = 30_000;
    const second = await oracle.reading();
    expect(second).not.toBe(first);
    expect([c.reads, l.reads]).toEqual([2, 2]);
    expect(second.validUntil).toBe(60_000);
  });

  it('shares one in-flight read between concurrent callers', async () => {
    const { oracle, c } = setup(LINK);
    await Promise.all([oracle.reading(), oracle.reading(), oracle.reading()]);
    expect(c.reads).toBe(1);
  });

  it('does not cache a rejected read', async () => {
    const { oracle, c } = setup(new Error('rpc down'));
    await expect(oracle.reading()).rejects.toThrow('rpc down');
    c.set(LINK);
    expect((await oracle.reading()).chosen.source).toBe('curve');
  });

  it('throws for USDC until it has a source', async () => {
    const { oracle, c } = setup(LINK);
    await expect(oracle.reading('USDC')).rejects.toThrow('no price source for USDC');
    expect(c.reads).toBe(0);
  });
});

describe('GuardedOracle quote', () => {
  it('converts USD into ARGt at the chosen rate and carries the flags', async () => {
    const { oracle } = setup(1658_360000000000000000n, 1657_900000000000000000n);
    const quote = await oracle.quote(parseMoney('0.01', 6, 'USD'), 'ARGt');
    expect(quote.source).toBe('curve');
    expect(quote.guarded).toBe(false);
    expect(quote.amount).toMatchObject({ decimals: 18, currency: 'ARGt' });
    expect(quote.amount.units).toBeGreaterThanOrEqual(16_583_600_000_000_000_000n);
    expect(quote.amount.units).toBeLessThan(16_583_600_000_000_000_010n);
    expect(quote.rate.decimals).toBe(36);
    expect(quote.validUntil).toBe(30_000);
  });

  it('prices with Chainlink when guarded', async () => {
    const { oracle } = setup(1700_000000000000000000n, 1657_900000000000000000n);
    const quote = await oracle.quote(parseMoney('1', 6, 'USD'), 'ARGt');
    expect(quote.source).toBe('chainlink');
    expect(quote.guarded).toBe(true);
    expect(quote.amount.units).toBeGreaterThanOrEqual(1657_900000000000000000n);
    expect(quote.amount.units).toBeLessThan(1657_900000000000000100n);
  });
});
