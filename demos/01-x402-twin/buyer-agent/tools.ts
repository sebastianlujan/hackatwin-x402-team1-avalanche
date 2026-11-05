import { defineTool, type Emit, type Tool, usdAtRate } from '@hackatwin/agent-kit';
import {
  type Address,
  type Feedback,
  formatMoney,
  type Hex,
  type Money,
  type PaymentGateway,
  type PriceOracle,
} from '@hackatwin/core';
import { z } from 'zod';

// The two calls rating needs from the identity adapter.
export interface SellerRating {
  ownerOf(agentId: bigint): Promise<Address>;
  giveFeedback(feedback: Feedback): Promise<Hex>;
}

export interface BuyerToolsOptions {
  readonly oracle: PriceOracle;
  // The profile's per-payment cap in USD; nothing the model sends can change it.
  readonly perPayment: Money;
  readonly url: string;
  readonly createGateway: (usdValue: (ask: Money) => Money) => PaymentGateway;
  readonly rating: SellerRating;
  readonly sellerAgentId: bigint;
  readonly now?: () => number;
}

const none = z.object({});

// Tools hold no cap: the ceiling is the buyer's own quote of the profile cap, never the seller's rate.
export function createBuyerTools(options: BuyerToolsOptions): Tool<never>[] {
  const { oracle, perPayment, rating, sellerAgentId, now = Date.now } = options;
  let paidTo: Address | undefined;
  let rated = false;
  return [
    defineTool({
      name: 'quote',
      description: 'Ask the buyer oracle for the current ARGt price of one USD.',
      input: none,
      async run() {
        const quote = await oracle.quote({ units: 10n ** 6n, decimals: 6, currency: 'USD' }, 'ARGt');
        return `1 USD = ${formatMoney(quote.amount)} (source ${quote.source}${quote.guarded ? ', guarded' : ''})`;
      },
    }),
    defineTool({
      name: 'buy',
      description: 'Buy one ARS/USD market-rate quote from the seller API, paid in ARGt within the budget.',
      input: none,
      async run() {
        const quote = await oracle.quote(perPayment, 'ARGt');
        const gateway = options.createGateway((ask) => usdAtRate(ask, quote.rate));
        const paid = await gateway.pay({ url: options.url, method: 'GET', maxAmount: quote.amount });
        if (paid.status !== 200 || paid.payment?.status !== 'Settled') {
          throw new Error(`the purchase failed with HTTP ${paid.status}`);
        }
        paidTo = paid.payment.payee;
        return `paid ${formatMoney(paid.payment.amount)} to ${paid.payment.payee}; the seller answered HTTP 200: ${paid.body}`;
      },
    }),
    defineTool({
      name: 'rate_seller',
      description: 'Post one positive rating for the seller after a completed purchase.',
      input: none,
      async run(_input, { emit }: { emit: Emit }) {
        if (paidTo === undefined) throw new Error('there is no completed purchase in this run, nothing to rate');
        if (rated) throw new Error('the seller was already rated in this run');
        const owner = await rating.ownerOf(sellerAgentId);
        if (owner.toLowerCase() !== paidTo.toLowerCase()) {
          throw new Error(`seller agentId ${sellerAgentId} is not owned by the address that was paid`);
        }
        const txHash = await rating.giveFeedback({
          agentId: sellerAgentId,
          value: 1n,
          valueDecimals: 0,
          tag1: 'x402',
          tag2: 'fx-quote',
        });
        rated = true;
        emit({ version: 1, type: 'identity.feedback', at: now(), agentId: sellerAgentId, txHash });
        return `posted one positive rating for seller agentId ${sellerAgentId}`;
      },
    }),
  ];
}
