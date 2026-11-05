import type { Money } from '@hackatwin/core';

export class AllowanceShortfallError extends Error {
  override readonly name = 'AllowanceShortfallError';
  readonly allowance: bigint;
  readonly amount: bigint;
  constructor(allowance: bigint, amount: bigint) {
    super(`Permit2 allowance ${allowance} is below the ${amount} the seller asks, short by ${amount - allowance}`);
    this.allowance = allowance;
    this.amount = amount;
  }
}

export class AboveMaxAmountError extends Error {
  override readonly name = 'AboveMaxAmountError';
  readonly ask: Money;
  readonly maxAmount: Money;
  constructor(ask: Money, maxAmount: Money) {
    super(`the seller asks ${ask.units} base units, above the ceiling of ${maxAmount.units}`);
    this.ask = ask;
    this.maxAmount = maxAmount;
  }
}

export class PaymentDeniedError extends Error {
  override readonly name = 'PaymentDeniedError';
  readonly reason: string;
  constructor(reason: string) {
    super(`the policy denied the payment: ${reason}`);
    this.reason = reason;
  }
}

export class PaymentRequirementsError extends Error {
  override readonly name = 'PaymentRequirementsError';
}
