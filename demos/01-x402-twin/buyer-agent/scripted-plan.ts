import { type PlanStep, toolOutcomes } from '@hackatwin/agent-kit';

const bought = (outcomes: ReturnType<typeof toolOutcomes>): boolean =>
  outcomes.some((outcome) => outcome.name === 'buy' && !outcome.isError);

// Quote, buy, then rate the seller only if the purchase returned 200 (ADR 0008).
export const buyerPlan: readonly PlanStep[] = [
  () => ({
    reasoning: 'I read the current ARGt price of one USD from my own oracle before paying anyone.',
    calls: [{ name: 'quote', input: {} }],
  }),
  () => ({
    reasoning: 'The rate is readable, so I buy one quote from the seller within my per-payment cap.',
    calls: [{ name: 'buy', input: {} }],
  }),
  (messages) =>
    bought(toolOutcomes(messages))
      ? {
          reasoning: 'The seller answered 200 after settlement, so I rate it once.',
          calls: [{ name: 'rate_seller', input: {} }],
        }
      : {
          reasoning: 'The purchase did not complete, so I will not rate the seller.',
          text: 'The purchase failed and no rating was posted.',
        },
  (messages) => ({
    reasoning: 'The run is complete.',
    text: bought(toolOutcomes(messages)) ? 'Bought one quote and rated the seller.' : 'Stopped without a purchase.',
  }),
];
