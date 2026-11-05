import { defineTool, type Tool } from '@hackatwin/agent-kit';
import { type CrossChainMessenger, formatMoney, type Hop, type Money, type PaymentStatus } from '@hackatwin/core';
import { z } from 'zod';
import type { World } from '../deployment.ts';
import { laneIdOf, paymentPayload } from '../lane.ts';

const TTL_SECONDS = 3600n;
const TERMINAL: ReadonlySet<PaymentStatus> = new Set(['Settled', 'Rejected', 'Refunded']);

export interface PaymentToolsOptions {
  readonly messenger: CrossChainMessenger;
  readonly world: World;
  // The profile's per-payment amount; nothing the model sends can change it.
  readonly amount: Money;
  // The hub block time in seconds, for the payment deadline.
  readonly chainTime: () => Promise<bigint>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly pollMs?: number;
  readonly maxPolls?: number;
  readonly now?: () => number;
}

const none = z.object({});

// A rejection carries the reason the contract gave.
const reasonOf = (hop: Hop): string => (hop as { reason?: string }).reason ?? 'no reason given';

export function createPaymentTools(options: PaymentToolsOptions): Tool<never>[] {
  const { messenger, world, amount, chainTime, pollMs = 1000, maxPolls = 60, now = Date.now } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let messageId: string | undefined;
  return [
    defineTool({
      name: 'send_payment',
      description: 'Send the one budgeted payment from the hub to the merchant on the L1 through the messenger.',
      input: none,
      async run(_input, { policy }) {
        if (messageId !== undefined) throw new Error(`a payment was already sent in this run: ${messageId}`);
        const decision = await policy.authorize(amount);
        if (!decision.allowed) throw new Error(`the policy refused the payment: ${decision.reason}`);
        const deadline = (await chainTime()) + TTL_SECONDS;
        const payload = paymentPayload({
          lane: laneIdOf(world),
          payer: world.roles.treasury,
          amount: amount.units,
          deadline,
        });
        messageId = await messenger.send({
          destinationChainId: world.chains.l1.chainId,
          recipient: world.contracts.broker,
          amount,
          payload,
        });
        await policy.record(amount);
        return `sent ${formatMoney(amount)} as message ${messageId}`;
      },
    }),
    defineTool({
      name: 'track_payment',
      description: 'Follow the payment sent in this run, hop by hop, until it settles or is rejected.',
      input: none,
      async run(_input, { emit }) {
        const id = messageId;
        if (id === undefined) throw new Error('no payment was sent in this run, nothing to track');
        let last: PaymentStatus = 'None';
        for (let poll = 1; poll <= maxPolls; poll++) {
          for await (const hop of messenger.track(id)) {
            emit({ version: 1, type: 'hop', at: now(), messageId: id, hop });
            last = hop.status;
            if (TERMINAL.has(hop.status)) {
              return hop.status === 'Rejected'
                ? `the payment was Rejected: ${reasonOf(hop)}`
                : `the payment ${hop.status} at hop ${hop.index}`;
            }
          }
          if (poll < maxPolls) await sleep(pollMs);
        }
        throw new Error(`the payment is still ${last} after ${maxPolls} polls, is the relay running?`);
      },
    }),
  ];
}
