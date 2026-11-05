import type { CrossChainMessenger, Hop, Transfer } from '../ports/cross-chain-messenger.ts';

export class FakeCrossChainMessenger implements CrossChainMessenger {
  readonly sent: Transfer[] = [];

  private readonly hops: readonly Hop[];

  constructor(hops: readonly Hop[] = []) {
    this.hops = hops;
  }

  async send(transfer: Transfer): Promise<string> {
    this.sent.push(transfer);
    return `message-${this.sent.length}`;
  }

  async *track(_messageId: string): AsyncIterable<Hop> {
    yield* this.hops;
  }
}
