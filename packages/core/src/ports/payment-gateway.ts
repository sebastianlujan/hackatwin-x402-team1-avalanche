import type { Money } from '../domain/money.ts';
import type { PaymentIntent } from '../domain/payment.ts';

export interface PaymentRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly body?: string;
  readonly maxAmount: Money;
}

export interface PaidResponse {
  readonly status: number;
  readonly body: string;
  readonly payment?: PaymentIntent;
}

export interface PaymentGateway {
  pay(request: PaymentRequest): Promise<PaidResponse>;
}
