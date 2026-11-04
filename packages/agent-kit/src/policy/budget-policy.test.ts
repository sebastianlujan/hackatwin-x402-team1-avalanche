import { type AgentEvent, type Money, money, parseMoney } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { BudgetPolicy } from './budget-policy.ts';

const usd = (text: string): Money => parseMoney(text, 6, 'USD');
const budget = { perPayment: usd('1.00'), total: usd('2.00') };

function setup() {
  const events: AgentEvent[] = [];
  return {
    events,
    policy: new BudgetPolicy(
      budget,
      (event) => events.push(event),
      () => 7,
    ),
  };
}

describe('BudgetPolicy per-payment cap', () => {
  it('allows a payment equal to the cap', async () => {
    const { policy } = setup();
    expect(await policy.authorize(usd('1.00'))).toEqual({ allowed: true, reason: 'within_budget' });
  });

  it('denies a payment above the cap', async () => {
    const { policy } = setup();
    expect(await policy.authorize(usd('1.01'))).toEqual({ allowed: false, reason: 'per_payment_cap' });
  });

  it('compares across decimals without rounding', async () => {
    const { policy } = setup();
    expect((await policy.authorize(money(1_000_000_000_000_000_001n, 18, 'USD'))).allowed).toBe(false);
    expect((await policy.authorize(money(1_000_000_000_000_000_000n, 18, 'USD'))).allowed).toBe(true);
  });
});

describe('BudgetPolicy total cap', () => {
  it('allows reaching the total and denies going over it', async () => {
    const { policy } = setup();
    await policy.record(usd('1.50'));
    expect(await policy.authorize(usd('0.50'))).toEqual({ allowed: true, reason: 'within_budget' });
    expect(await policy.authorize(usd('0.51'))).toEqual({ allowed: false, reason: 'total_cap' });
  });

  it('counts only recorded spend', async () => {
    const { policy } = setup();
    await policy.authorize(usd('1.00'));
    await policy.authorize(usd('1.00'));
    expect((await policy.authorize(usd('1.00'))).allowed).toBe(true);
  });

  it('reports the per-payment cap before the total cap', async () => {
    const { policy } = setup();
    await policy.record(usd('1.90'));
    expect((await policy.authorize(usd('1.50'))).reason).toBe('per_payment_cap');
  });
});

describe('BudgetPolicy events', () => {
  it('emits one policy.decision per decision with its reason', async () => {
    const { policy, events } = setup();
    await policy.authorize(usd('0.25'));
    await policy.authorize(usd('5.00'));
    expect(events).toEqual([
      { version: 1, type: 'policy.decision', at: 7, amount: usd('0.25'), allowed: true, reason: 'within_budget' },
      { version: 1, type: 'policy.decision', at: 7, amount: usd('5.00'), allowed: false, reason: 'per_payment_cap' },
    ]);
  });
});

describe('BudgetPolicy caps from the profile only', () => {
  it('applies the budget it was built with', async () => {
    const events: AgentEvent[] = [];
    const tight = new BudgetPolicy({ perPayment: usd('0.10'), total: usd('0.20') }, (event) => events.push(event));
    expect((await tight.authorize(usd('0.11'))).reason).toBe('per_payment_cap');
    expect((await tight.authorize(usd('0.10'))).allowed).toBe(true);
  });
});
