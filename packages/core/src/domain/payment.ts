import type { Address, Money } from './money.ts';

export type PaymentStatus = 'None' | 'Pending' | 'Settled' | 'Dispatched' | 'Refunded' | 'Received' | 'Rejected';

export interface PaymentIntent {
  readonly id: string;
  readonly payer: Address;
  readonly payee: Address;
  readonly amount: Money;
  readonly chainId: number;
  readonly status: PaymentStatus;
}

export interface Quote {
  readonly price: Money;
  readonly rate: Money;
  readonly amount: Money;
  readonly source: 'curve' | 'chainlink';
  readonly guarded: boolean;
  readonly validUntil: number;
}
