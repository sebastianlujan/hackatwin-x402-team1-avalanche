import { type AgentEvent, formatMoney, type Hex, money } from '@hackatwin/core';
import type { Envelope } from './envelope.ts';
import { formatAmount, formatRate, type Shown, shownAmount } from './format.ts';

export type TimelineKind =
  | 'llm.reasoning'
  | 'llm.tool-call'
  | 'policy.decision'
  | 'payment.required'
  | 'payment.signed'
  | 'resource.received'
  | 'run.finished';

export interface TimelineEntry {
  readonly seq: number;
  readonly kind: TimelineKind;
  readonly detail: string;
  readonly value?: string;
  readonly valueFull?: string;
  readonly failed: boolean;
}

export type StepState = 'idle' | 'done' | 'stopped';

export interface Strip {
  readonly required: StepState;
  readonly paid: StepState;
  readonly received: StepState;
}

export interface QuoteView {
  readonly source: 'curve' | 'chainlink';
  readonly rate: Shown;
  readonly amount: Shown;
  readonly price: Shown;
  readonly validUntil: string;
  readonly guarded: boolean;
}

export interface ForkHash {
  readonly seq: number;
  readonly kind: 'payment.status' | 'identity.feedback';
  readonly hash: Hex;
  readonly transition?: { readonly from: string; readonly to: string };
}

export interface Finished {
  readonly reason: 'done' | 'max-steps' | 'refusal' | 'error';
  readonly message?: string;
  readonly failed: boolean;
}

export interface Demo1View {
  readonly timeline: readonly TimelineEntry[];
  readonly strip: Strip;
  readonly quote?: QuoteView;
  readonly forkHashes: readonly ForkHash[];
  readonly finished?: Finished;
}

const compact = (input: unknown): string => {
  const text = JSON.stringify(input) ?? '';
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

const clock = (ms: number): string => `${new Date(ms).toISOString().slice(11, 19)} UTC`;

function entryOf(seq: number, event: AgentEvent): TimelineEntry | undefined {
  switch (event.type) {
    case 'llm.reasoning':
      return { seq, kind: event.type, detail: event.text, failed: false };
    case 'llm.tool-call':
      return { seq, kind: event.type, detail: event.tool, value: compact(event.input), failed: false };
    case 'policy.decision':
      return {
        seq,
        kind: event.type,
        detail: event.reason,
        value: formatAmount(event.amount),
        valueFull: formatMoney(event.amount),
        failed: !event.allowed,
      };
    case 'payment.required':
      return {
        seq,
        kind: event.type,
        detail: event.quote.source,
        value: formatAmount(event.quote.amount),
        valueFull: formatMoney(event.quote.amount),
        failed: false,
      };
    case 'payment.signed':
      return {
        seq,
        kind: event.type,
        detail: event.intent.id,
        value: formatAmount(event.intent.amount),
        valueFull: formatMoney(event.intent.amount),
        failed: false,
      };
    case 'resource.received':
      return { seq, kind: event.type, detail: String(event.status), failed: event.status !== 200 };
    case 'run.finished':
      return {
        seq,
        kind: event.type,
        detail: event.message ?? '',
        value: event.reason,
        failed: event.reason !== 'done',
      };
    default:
      return undefined;
  }
}

// The first step that has not completed is where a refused or failed run stops.
function stripOf(events: readonly AgentEvent[]): Strip {
  const steps: [StepState, StepState, StepState] = ['idle', 'idle', 'idle'];
  let halted = false;
  for (const event of events) {
    if (event.type === 'payment.required') steps[0] = 'done';
    if (event.type === 'payment.signed') steps[1] = 'done';
    if (event.type === 'resource.received') {
      steps[2] = event.status === 200 ? 'done' : 'stopped';
      halted ||= event.status !== 200;
    }
    if (event.type === 'policy.decision' && !event.allowed) halted = true;
    if (event.type === 'run.finished' && event.reason !== 'done') halted = true;
  }
  const open = steps.indexOf('idle');
  if (halted && open !== -1) steps[open] = 'stopped';
  return { required: steps[0], paid: steps[1], received: steps[2] };
}

// Frames repeat after a reconnect; a seq already seen, or older than the last, is dropped.
export function dedupeFrames(frames: readonly Envelope[]): Envelope[] {
  const kept: Envelope[] = [];
  for (const frame of frames) if (frame.seq > (kept.at(-1)?.seq ?? 0)) kept.push(frame);
  return kept;
}

export function deriveDemo1(frames: readonly Envelope[]): Demo1View {
  const kept = dedupeFrames(frames);
  const events = kept.map((f) => f.event);
  const timeline = kept.flatMap((f) => entryOf(f.seq, f.event) ?? []);
  const required = events.findLast((e) => e.type === 'payment.required');
  const finished = events.findLast((e) => e.type === 'run.finished');
  const forkHashes = kept.flatMap<ForkHash>(({ seq, event }) => {
    if (event.type === 'payment.status')
      return [{ seq, kind: event.type, hash: event.txHash, transition: { from: event.from, to: event.to } }];
    return event.type === 'identity.feedback' ? [{ seq, kind: event.type, hash: event.txHash }] : [];
  });
  return {
    timeline,
    strip: stripOf(events),
    forkHashes,
    ...(required === undefined
      ? {}
      : {
          quote: {
            source: required.quote.source,
            rate: {
              text: formatRate(required.quote.rate, required.quote.amount.currency),
              full: formatMoney(required.quote.rate),
            },
            amount: shownAmount(required.quote.amount),
            price: shownAmount(required.quote.price),
            validUntil: clock(required.quote.validUntil),
            guarded: required.quote.guarded,
          },
        }),
    ...(finished === undefined
      ? {}
      : {
          finished: {
            reason: finished.reason,
            ...(finished.message === undefined ? {} : { message: finished.message }),
            failed: finished.reason !== 'done',
          },
        }),
  };
}

// Balances arrive from GET /api/runs/[id] as decimal strings of ARGt base units.
export interface BalancePair {
  readonly agent: string;
  readonly seller: string;
}

export interface PartyBalance {
  readonly before: Shown;
  readonly after?: Shown;
  readonly change?: Shown;
}

export interface BalanceView {
  readonly agent: PartyBalance;
  readonly seller: PartyBalance;
  readonly moved?: Shown;
}

const ARGT_DECIMALS = 18;
const argt = (units: bigint): Shown => shownAmount(money(units, ARGT_DECIMALS, 'ARGt'));
const withSign = (sign: string, shown: Shown): Shown => ({
  text: `${sign}${shown.text}`,
  full: `${sign}${shown.full}`,
});
const units = (text: string): bigint | undefined => (/^\d+$/.test(text) ? BigInt(text) : undefined);

function party(before: string, after: string | undefined): PartyBalance | undefined {
  const b = units(before);
  if (b === undefined) return undefined;
  const a = after === undefined ? undefined : units(after);
  if (a === undefined) return { before: argt(b) };
  const sign = a < b ? '-' : '+';
  return { before: argt(b), after: argt(a), change: withSign(sign, argt(a < b ? b - a : a - b)) };
}

export function balanceView(before: BalancePair | undefined, after: BalancePair | undefined): BalanceView | undefined {
  if (before === undefined) return undefined;
  const agent = party(before.agent, after?.agent);
  const seller = party(before.seller, after?.seller);
  if (agent === undefined || seller === undefined) return undefined;
  const paid = units(before.agent);
  const left = after === undefined ? undefined : units(after.agent);
  const moved = paid === undefined || left === undefined ? undefined : argt(paid > left ? paid - left : left - paid);
  return { agent, seller, ...(moved === undefined ? {} : { moved }) };
}
