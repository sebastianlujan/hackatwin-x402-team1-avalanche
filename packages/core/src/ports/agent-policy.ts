import type { Money } from '../domain/money.ts';

export interface AgentPolicy {
  authorize(amount: Money): Promise<{ readonly allowed: boolean; readonly reason: string }>;
  record(amount: Money): Promise<void>;
}
