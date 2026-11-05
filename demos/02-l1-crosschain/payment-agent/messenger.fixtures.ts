import type { CrossChainMessenger, Hop, PaymentStatus } from '@hackatwin/core';
import { FakeCrossChainMessenger } from '@hackatwin/core/testing';

export const hop = (index: number, status: PaymentStatus, chainId = 31337): Hop => ({
  index,
  transport: 'local',
  chainId,
  status,
  txHash: `0x${index.toString(16).padStart(64, '0')}`,
});

// Each `track` call reveals the next batch, like the real tracker after its progress mark.
export class RelayedMessenger extends FakeCrossChainMessenger implements CrossChainMessenger {
  private readonly batches: Hop[][];
  tracks = 0;
  constructor(batches: Hop[][]) {
    super();
    this.batches = batches;
  }
  override async *track(_messageId: string): AsyncIterable<Hop> {
    yield* this.batches[Math.min(this.tracks++, this.batches.length - 1)] ?? [];
  }
}
