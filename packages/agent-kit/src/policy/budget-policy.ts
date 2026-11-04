import { type AgentEvent, type AgentPolicy, type Money, MoneyError, money } from '@hackatwin/core';

// `above_max_amount` is emitted by the x402 client before the policy is consulted.
export type PolicyReason = 'per_payment_cap' | 'total_cap' | 'within_budget' | 'above_max_amount';

export interface Budget {
  readonly perPayment: Money;
  readonly total: Money;
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

// Compares amounts of one currency at different decimals without rounding.
const exceeds = (a: Money, b: Money): boolean => {
  if (a.currency !== b.currency) throw new MoneyError(`Currency mismatch: ${a.currency} and ${b.currency}`);
  return a.units * pow10(b.decimals) > b.units * pow10(a.decimals);
};

const plus = (a: Money, b: Money): Money => {
  const decimals = Math.max(a.decimals, b.decimals);
  return money(a.units * pow10(decimals - a.decimals) + b.units * pow10(decimals - b.decimals), decimals, a.currency);
};

// The caps come only from the profile budget given here; no tool input reaches them.
export class BudgetPolicy implements AgentPolicy {
  private readonly budget: Budget;
  private readonly emit: (event: AgentEvent) => void;
  private readonly now: () => number;
  private spent: Money;

  constructor(budget: Budget, emit: (event: AgentEvent) => void, now: () => number = Date.now) {
    this.budget = budget;
    this.emit = emit;
    this.now = now;
    this.spent = money(0n, budget.total.decimals, budget.total.currency);
  }

  async authorize(amount: Money): Promise<{ readonly allowed: boolean; readonly reason: PolicyReason }> {
    const reason: PolicyReason = exceeds(amount, this.budget.perPayment)
      ? 'per_payment_cap'
      : exceeds(plus(this.spent, amount), this.budget.total)
        ? 'total_cap'
        : 'within_budget';
    const allowed = reason === 'within_budget';
    this.emit({ version: 1, type: 'policy.decision', at: this.now(), amount, allowed, reason });
    return { allowed, reason };
  }

  async record(amount: Money): Promise<void> {
    this.spent = plus(this.spent, amount);
  }
}
