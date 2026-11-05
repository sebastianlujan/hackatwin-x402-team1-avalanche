import type { GuardedReading } from './guarded-oracle.ts';

export interface QuoteIo {
  out(line: string): void;
  err(line: string): void;
}

const TENTH = 10n ** 17n;

// 18-decimal rate to one decimal, half-up
const rate = (units: bigint): string => {
  const tenths = (units + TENTH / 2n) / TENTH;
  return `${tenths / 10n}.${tenths % 10n}`;
};

const percent = (bps: bigint): string => `${bps / 100n}.${(bps % 100n).toString().padStart(2, '0')}`;

export function formatQuoteLine({ chosen, curve, chainlink, deltaBps, guarded }: GuardedReading): string {
  const delta = `Δ ${percent(deltaBps)}%`;
  return guarded
    ? `1 USD = ${rate(chosen.argtPerUsd)} ARGt (Chainlink, guarded) | Curve ${rate(curve.argtPerUsd)} (block ${curve.blockNumber}) | ${delta} ⚠`
    : `1 USD = ${rate(chosen.argtPerUsd)} ARGt (Curve, block ${curve.blockNumber}) | Chainlink ${rate(chainlink.argtPerUsd)} | ${delta} ✓`;
}

// first line only, URLs masked so an RPC key never reaches the terminal
export function describeFailure(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return `quote failed: ${(text.split('\n')[0] ?? '').replace(/\b(?:https?|wss?):\/\/\S+/g, '<url>')}`;
}

// returns the process exit code
export async function runQuote(oracle: { reading(): Promise<GuardedReading> }, io: QuoteIo): Promise<number> {
  try {
    io.out(formatQuoteLine(await oracle.reading()));
    return 0;
  } catch (error) {
    io.err(describeFailure(error));
    return 1;
  }
}
