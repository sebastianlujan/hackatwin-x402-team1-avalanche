import { type AssetSymbol, convertMoney, type Money, money, type PriceOracle, type Quote } from '@hackatwin/core';
import { PricingError } from './pricing-error.ts';
import type { RateReading, RateSource } from './rate-reading.ts';

export const BAND_BPS = 200n;
export const FREEZE_MS = 30_000;

export interface GuardedReading {
  readonly chosen: RateReading;
  readonly curve: RateReading;
  readonly chainlink: RateReading;
  readonly deltaBps: bigint;
  readonly guarded: boolean;
  readonly validUntil: number;
}

interface Frozen {
  readonly validUntil: number;
  readonly pending: Promise<GuardedReading>;
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

export class GuardedOracle implements PriceOracle {
  private readonly curve: RateSource;
  private readonly chainlink: RateSource;
  private readonly now: () => number;
  private readonly frozen = new Map<AssetSymbol, Frozen>();

  // now returns epoch milliseconds
  constructor(curve: RateSource, chainlink: RateSource, now: () => number = Date.now) {
    this.curve = curve;
    this.chainlink = chainlink;
    this.now = now;
  }

  reading(asset: AssetSymbol = 'ARGt'): Promise<GuardedReading> {
    if (asset !== 'ARGt') return Promise.reject(new PricingError(`no price source for ${asset} yet`));
    const current = this.frozen.get(asset);
    if (current !== undefined && this.now() < current.validUntil) return current.pending;
    const validUntil = this.now() + FREEZE_MS;
    const pending = this.read(validUntil);
    this.frozen.set(asset, { validUntil, pending });
    pending.catch(() => {
      if (this.frozen.get(asset)?.pending === pending) this.frozen.delete(asset);
    });
    return pending;
  }

  async quote(price: Money, asset: AssetSymbol): Promise<Quote> {
    const { chosen, guarded, validUntil } = await this.reading(asset);
    // USD per ARGt with 36 decimals, rounded down so the converted amount rounds up
    const rate = money(10n ** 54n / chosen.argtPerUsd, 36, 'USD');
    const amount = convertMoney(price, rate, { decimals: 18, currency: asset });
    return { price, rate, amount, source: chosen.source, guarded, validUntil };
  }

  private async read(validUntil: number): Promise<GuardedReading> {
    const [curve, chainlink] = await Promise.all([this.curve.reading(), this.chainlink.reading()]);
    const gap = abs(curve.argtPerUsd - chainlink.argtPerUsd);
    const guarded = gap * 10_000n > BAND_BPS * chainlink.argtPerUsd;
    const deltaBps = (gap * 20_000n + chainlink.argtPerUsd) / (2n * chainlink.argtPerUsd);
    return { chosen: guarded ? chainlink : curve, curve, chainlink, deltaBps, guarded, validUntil };
  }
}
