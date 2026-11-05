import type { Hex, Money } from './money.ts';
import type { PaymentIntent, PaymentStatus, Quote } from './payment.ts';

export interface Hop {
  readonly index: number;
  readonly transport: 'ccip' | 'local' | 'ictt' | 'icm';
  readonly chainId: number;
  readonly status: PaymentStatus;
  readonly txHash: Hex;
  readonly explorerUrl: string;
}

interface Base<T extends string> {
  readonly version: 1;
  readonly type: T;
  readonly at: number;
}

export type AgentEvent =
  | (Base<'run.started'> & { readonly agent: string; readonly profile: string })
  | (Base<'llm.reasoning'> & { readonly text: string })
  | (Base<'llm.tool-call'> & { readonly tool: string; readonly input: unknown })
  | (Base<'policy.decision'> & { readonly amount: Money; readonly allowed: boolean; readonly reason: string })
  | (Base<'payment.required'> & { readonly resource: string; readonly quote: Quote })
  | (Base<'payment.signed'> & { readonly intent: PaymentIntent })
  | (Base<'payment.status'> & {
      readonly paymentId: string;
      readonly chainId: number;
      readonly from: PaymentStatus;
      readonly to: PaymentStatus;
      readonly txHash: Hex;
    })
  | (Base<'hop'> & { readonly messageId: string; readonly hop: Hop })
  | (Base<'resource.received'> & { readonly resource: string; readonly status: number })
  | (Base<'identity.feedback'> & { readonly agentId: bigint; readonly txHash: Hex })
  | (Base<'run.finished'> & {
      readonly reason: 'done' | 'max-steps' | 'refusal' | 'error';
      readonly message?: string;
    });

export class AgentEventError extends Error {
  override readonly name = 'AgentEventError';
}

const TYPES: ReadonlySet<string> = new Set([
  'run.started',
  'llm.reasoning',
  'llm.tool-call',
  'policy.decision',
  'payment.required',
  'payment.signed',
  'payment.status',
  'hop',
  'resource.received',
  'identity.feedback',
  'run.finished',
]);

export const encodeAgentEvent = (event: AgentEvent): string =>
  JSON.stringify(event, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));

type Json = Record<string, unknown>;

const bigintOf = (value: unknown, path: string): bigint => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AgentEventError(`${path} must be a decimal string`);
  return BigInt(value);
};

const objectOf = (value: unknown, path: string): Json => {
  if (typeof value !== 'object' || value === null) throw new AgentEventError(`${path} must be an object`);
  return value as Json;
};

const reviveMoney = (value: unknown, path: string): Money => {
  const m = objectOf(value, path);
  return { ...(m as unknown as Money), units: bigintOf(m.units, `${path}.units`) };
};

export const decodeAgentEvent = (text: string): AgentEvent => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AgentEventError('AgentEvent is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new AgentEventError('AgentEvent must be an object');
  const event = raw as Json;
  if (event.version !== 1) throw new AgentEventError(`Unsupported AgentEvent version: ${String(event.version)}`);
  if (typeof event.type !== 'string' || !TYPES.has(event.type)) {
    throw new AgentEventError(`Unknown AgentEvent type: ${String(event.type)}`);
  }
  switch (event.type) {
    case 'policy.decision':
      return { ...event, amount: reviveMoney(event.amount, 'amount') } as unknown as AgentEvent;
    case 'payment.required': {
      const quote = objectOf(event.quote, 'quote');
      const revived = {
        ...quote,
        price: reviveMoney(quote.price, 'quote.price'),
        rate: reviveMoney(quote.rate, 'quote.rate'),
        amount: reviveMoney(quote.amount, 'quote.amount'),
      };
      return { ...event, quote: revived } as unknown as AgentEvent;
    }
    case 'payment.signed': {
      const intent = objectOf(event.intent, 'intent');
      return {
        ...event,
        intent: { ...intent, amount: reviveMoney(intent.amount, 'intent.amount') },
      } as unknown as AgentEvent;
    }
    case 'identity.feedback':
      return { ...event, agentId: bigintOf(event.agentId, 'agentId') } as unknown as AgentEvent;
    default:
      return event as unknown as AgentEvent;
  }
};
