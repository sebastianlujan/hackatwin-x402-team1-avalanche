import { type PlanStep, toolOutcomes } from '@hackatwin/agent-kit';

const outcome = (messages: Parameters<PlanStep>[0], name: string) =>
  toolOutcomes(messages).find((item) => item.name === name);

// Send once, follow the payment, then report how it ended (ADR 0008).
export const paymentPlan: readonly PlanStep[] = [
  () => ({
    reasoning: 'I send the one budgeted payment to the merchant through the messenger.',
    calls: [{ name: 'send_payment', input: {} }],
  }),
  (messages) =>
    outcome(messages, 'send_payment')?.isError === false
      ? {
          reasoning: 'The payment is on its way, so I follow it hop by hop.',
          calls: [{ name: 'track_payment', input: {} }],
        }
      : {
          reasoning: 'The payment was not sent, so there is nothing to follow.',
          text: `The payment was not sent: ${outcome(messages, 'send_payment')?.content ?? 'unknown reason'}.`,
        },
  (messages) => {
    const tracked = outcome(messages, 'track_payment');
    return {
      reasoning: 'The run is complete.',
      text: tracked?.isError === false ? `Done: ${tracked.content}.` : `Stopped: ${tracked?.content ?? 'not tracked'}.`,
    };
  },
];
