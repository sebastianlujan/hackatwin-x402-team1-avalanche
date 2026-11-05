import type { PaidResponse, PaymentGateway, PaymentRequest } from '../ports/payment-gateway.ts';

export class FakePaymentGateway implements PaymentGateway {
  readonly requests: PaymentRequest[] = [];
  private readonly responses: PaidResponse[];

  constructor(responses: readonly PaidResponse[]) {
    this.responses = [...responses];
  }

  async pay(request: PaymentRequest): Promise<PaidResponse> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (!next) throw new Error('FakePaymentGateway has no scripted response left');
    return next;
  }
}
