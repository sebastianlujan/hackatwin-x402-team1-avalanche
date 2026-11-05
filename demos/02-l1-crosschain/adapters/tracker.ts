import type { Address, AgentEvent, Hex, Hop, PaymentStatus } from '@hackatwin/core';
import { type Decoded, decodeLogs, type LogReader, type TrackedLog } from './tracker-decode.ts';

// Highest hop index already emitted per message, -1 when none.
export interface HopProgress {
  last(messageId: string): number;
  record(messageId: string, index: number): void;
}

export interface TrackedChain {
  readonly key: string;
  readonly chainId: number;
  readonly local: boolean;
}

// A rejection carries the reason the contract gave.
export interface TrackedHop extends Hop {
  readonly reason?: string;
}
export type HopEvent = Extract<AgentEvent, { type: 'hop' }> & { readonly hop: TrackedHop };

export interface HopTrackerOptions {
  readonly reader: LogReader;
  readonly source: { readonly chain: TrackedChain; readonly router: Address };
  readonly hub: { readonly chain: TrackedChain; readonly broker: Address; readonly hub: Address };
  readonly l1: { readonly chain: TrackedChain; readonly receiver: Address; readonly remote: Address };
  readonly progress?: HopProgress;
  readonly explorerUrl?: (chainKey: string, txHash: Hex) => string | undefined;
  readonly now?: () => number;
}

export class MessageNotFoundError extends Error {
  override readonly name = 'MessageNotFoundError';
  constructor(messageId: string) {
    super(`no logs found for message ${messageId}`);
  }
}
interface Located {
  readonly hop: TrackedHop;
  readonly local: boolean;
}

type Contracts = Pick<HopTrackerOptions, 'source' | 'hub' | 'l1' | 'explorerUrl'>;

// Map: decoded facts of one message into hops. Indices are fixed, and the first fact for an index wins.
export const mapHops = (
  messageId: string,
  facts: { readonly source: readonly Decoded[]; readonly hub: readonly Decoded[]; readonly l1: readonly Decoded[] },
  config: Contracts,
): Located[] => {
  const id = messageId.toLowerCase();
  const out = new Map<number, Located>();
  const put = (
    index: number,
    transport: Hop['transport'],
    chain: TrackedChain,
    status: PaymentStatus,
    log: TrackedLog,
    reason?: string,
  ) => {
    if (out.has(index)) return;
    const explorerUrl = chain.local ? undefined : config.explorerUrl?.(chain.key, log.txHash);
    const hop: TrackedHop = {
      index,
      transport,
      chainId: chain.chainId,
      status,
      txHash: log.txHash,
      ...(explorerUrl === undefined ? {} : { explorerUrl }),
      ...(reason === undefined ? {} : { reason }),
    };
    out.set(index, { hop, local: chain.local });
  };
  const { source, hub, l1 } = config;
  for (const f of facts.source)
    if (f.kind === 'sent' && f.messageId === id) put(0, 'local', source.chain, 'None', f.log);
  const rejected = facts.hub.find((f) => f.kind === 'broker-rejected' && f.messageId === id);
  if (rejected?.kind === 'broker-rejected') {
    put(4, 'local', hub.chain, 'Rejected', rejected.log, rejected.reason);
    return [...out.values()].sort((a, b) => a.hop.index - b.hop.index);
  }
  const paymentId = facts.hub.find(
    (f) => (f.kind === 'accepted' || f.kind === 'dispatch-failed') && f.messageId === id,
  );
  if (paymentId?.kind !== 'accepted' && paymentId?.kind !== 'dispatch-failed') return [...out.values()];
  for (const f of facts.hub) {
    if (f.kind !== 'hub' || f.paymentId !== paymentId.paymentId) continue;
    if (f.to === 'Pending') put(1, 'local', hub.chain, 'Pending', f.log);
    if (f.to === 'Dispatched') put(2, 'ictt', hub.chain, 'Dispatched', f.log);
  }
  for (const f of facts.l1) {
    if (f.kind === 'receiver' && f.paymentId === paymentId.paymentId) {
      put(f.to === 'Received' ? 3 : 4, 'icm', l1.chain, f.to, f.log);
    } else if (f.kind === 'call-failed' && f.recipient === l1.receiver.toLowerCase()) {
      put(4, 'ictt', l1.chain, 'Rejected', f.log);
    }
  }
  return [...out.values()].sort((a, b) => a.hop.index - b.hop.index);
};

class MemoryProgress implements HopProgress {
  private readonly seen = new Map<string, number>();
  last(messageId: string): number {
    return this.seen.get(messageId) ?? -1;
  }
  record(messageId: string, index: number): void {
    this.seen.set(messageId, Math.max(index, this.last(messageId)));
  }
}

export class HopTracker {
  private readonly options: HopTrackerOptions;
  private readonly progress: HopProgress;
  private readonly now: () => number;

  constructor(options: HopTrackerOptions) {
    this.options = options;
    this.progress = options.progress ?? new MemoryProgress();
    this.now = options.now ?? Date.now;
  }

  // One pass over the logs: emits the hops after the recorded progress, then ends. Call again to poll.
  async *track(messageId: string): AsyncIterable<TrackedHop> {
    for (const { hop } of await this.pending(messageId)) yield hop;
  }

  async *events(messageId: string): AsyncIterable<HopEvent> {
    for (const { hop, local } of await this.pending(messageId)) {
      yield {
        version: 1,
        type: 'hop',
        at: this.now(),
        messageId,
        hop,
        ...(local ? { simulated: 'local-crosschain' as const } : {}),
      };
    }
  }

  private async pending(messageId: string): Promise<Located[]> {
    const found = await this.resolve(messageId);
    const last = this.progress.last(messageId);
    const fresh = found.filter(({ hop }) => hop.index > last);
    const highest = fresh.at(-1)?.hop.index;
    if (highest !== undefined) this.progress.record(messageId, highest);
    return fresh;
  }

  private async resolve(messageId: string): Promise<Located[]> {
    const { reader, source, hub, l1 } = this.options;
    const id = messageId.toLowerCase();
    const sent = decodeLogs('router', await reader.logs(source.chain.chainId, [source.router]));
    const hubLogs = await reader.logs(hub.chain.chainId, [hub.broker, hub.hub]);
    const decodedHub = [
      ...decodeLogs(
        'broker',
        hubLogs.filter((l) => l.address.toLowerCase() === hub.broker.toLowerCase()),
      ),
      ...decodeLogs(
        'hub',
        hubLogs.filter((l) => l.address.toLowerCase() === hub.hub.toLowerCase()),
      ),
    ];
    const known = [...sent, ...decodedHub].some((f) => 'messageId' in f && f.messageId === id);
    if (!known) throw new MessageNotFoundError(messageId);
    const l1Logs = decodedHub.some((f) => f.kind === 'accepted' || f.kind === 'dispatch-failed')
      ? await reader.logs(l1.chain.chainId, [l1.receiver, l1.remote])
      : [];
    const decodedL1 = [
      ...decodeLogs(
        'receiver',
        l1Logs.filter((l) => l.address.toLowerCase() === l1.receiver.toLowerCase()),
      ),
      ...decodeLogs(
        'remote',
        l1Logs.filter((l) => l.address.toLowerCase() === l1.remote.toLowerCase()),
      ),
    ];
    return mapHops(messageId, { source: sent, hub: decodedHub, l1: decodedL1 }, this.options);
  }
}
