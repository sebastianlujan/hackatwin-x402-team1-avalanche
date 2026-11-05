import { describe, expect, it } from 'vitest';
import type { GuardedReading } from './guarded-oracle.ts';
import { describeFailure, formatQuoteLine, runQuote } from './quote-line.ts';
import type { RateReading } from './rate-reading.ts';

const reading = (source: RateReading['source'], argt: bigint, block = 1n): RateReading => ({
  source,
  argtPerUsd: argt,
  chainId: 1,
  blockNumber: block,
});

const within: GuardedReading = {
  curve: reading('curve', 1658_340000000000000000n, 521122117n),
  chainlink: reading('chainlink', 1657_900000000000000000n, 53495781n),
  chosen: reading('curve', 1658_340000000000000000n, 521122117n),
  deltaBps: 3n,
  guarded: false,
  validUntil: 0,
};

const outside: GuardedReading = {
  curve: reading('curve', 1700_000000000000000000n, 42n),
  chainlink: reading('chainlink', 1657_900000000000000000n, 7n),
  chosen: reading('chainlink', 1657_900000000000000000n, 7n),
  deltaBps: 253n,
  guarded: true,
  validUntil: 0,
};

describe('formatQuoteLine', () => {
  it('prints the normal line when Curve is used', () => {
    expect(formatQuoteLine(within)).toBe('1 USD = 1658.3 ARGt (Curve, block 521122117) | Chainlink 1657.9 | Δ 0.03% ✓');
  });

  it('prints the guarded line when Chainlink is used', () => {
    expect(formatQuoteLine(outside)).toBe(
      '1 USD = 1657.9 ARGt (Chainlink, guarded) | Curve 1700.0 (block 42) | Δ 2.53% ⚠',
    );
  });

  it('rounds rates half-up to one decimal and pads the delta', () => {
    const line = formatQuoteLine({
      ...within,
      curve: reading('curve', 1658_350000000000000000n, 5n),
      chosen: reading('curve', 1658_350000000000000000n, 5n),
      deltaBps: 2n,
    });
    expect(line).toBe('1 USD = 1658.4 ARGt (Curve, block 5) | Chainlink 1657.9 | Δ 0.02% ✓');
  });
});

describe('runQuote', () => {
  const io = () => {
    const lines: { out: string[]; err: string[] } = { out: [], err: [] };
    return { lines, io: { out: (l: string) => lines.out.push(l), err: (l: string) => lines.err.push(l) } };
  };

  it('prints the line and returns 0', async () => {
    const { io: sink, lines } = io();
    expect(await runQuote({ reading: async () => within }, sink)).toBe(0);
    expect(lines.out).toEqual([formatQuoteLine(within)]);
    expect(lines.err).toEqual([]);
  });

  it('prints the error and returns a non-zero code when the oracle fails', async () => {
    const { io: sink, lines } = io();
    const failing = {
      reading: async (): Promise<GuardedReading> => {
        throw new Error('chainlink round is stale');
      },
    };
    expect(await runQuote(failing, sink)).toBe(1);
    expect(lines.out).toEqual([]);
    expect(lines.err).toEqual(['quote failed: chainlink round is stale']);
  });
});

describe('describeFailure', () => {
  it('keeps the first line and masks URLs', () => {
    const error = new Error('HTTP request failed.\n\nURL: https://rpc.example/key123\nDetails: fetch failed');
    expect(describeFailure(error)).toBe('quote failed: HTTP request failed.');
    expect(describeFailure(new Error('bad https://rpc.example/key123 here'))).toBe('quote failed: bad <url> here');
    expect(describeFailure('plain')).toBe('quote failed: plain');
  });
});
