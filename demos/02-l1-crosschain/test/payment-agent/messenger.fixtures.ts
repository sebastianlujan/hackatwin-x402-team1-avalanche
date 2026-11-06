import type { CrossChainMessenger, Hop, PaymentStatus, Transfer } from '@hackatwin/core';

export const hop = (index: number, status: PaymentStatus, chainId = 31337): Hop => ({
  index,
  transport: 'local',
  chainId,
  status,
  txHash: `0x${index.toString(16).padStart(64, '0')}`,
});

// Each `track` call reveals the next batch, like the real tracker after its progress mark.
export class RelayedMessenger implements CrossChainMessenger {
  readonly sent: Transfer[] = [];
  tracks = 0;
  private readonly batches: Hop[][];
  constructor(batches: Hop[][]) {
    this.batches = batches;
  }
  async send(transfer: Transfer): Promise<string> {
    this.sent.push(transfer);
    return `message-${this.sent.length}`;
  }
  async *track(_messageId: string): AsyncIterable<Hop> {
    yield* this.batches[Math.min(this.tracks++, this.batches.length - 1)] ?? [];
  }
}
