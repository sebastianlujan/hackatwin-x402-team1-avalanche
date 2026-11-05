import type { BalancePair } from './demo-1-state.ts';

export interface RunRecord {
  readonly before?: BalancePair | undefined;
  readonly after?: BalancePair | undefined;
}

const pair = (value: unknown): BalancePair | undefined => {
  const { agent, seller } = (value ?? {}) as { agent?: unknown; seller?: unknown };
  return typeof agent === 'string' && typeof seller === 'string' ? { agent, seller } : undefined;
};

// The body of GET /api/runs/[id]; anything unreadable counts as no balances.
export function parseRunRecord(body: unknown): RunRecord {
  const { before, after } = (body ?? {}) as { before?: unknown; after?: unknown };
  return { before: pair(before), after: pair(after) };
}
