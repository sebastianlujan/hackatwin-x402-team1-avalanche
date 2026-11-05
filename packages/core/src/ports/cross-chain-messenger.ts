import type { Hop } from '../domain/agent-event.ts';
import type { Address, Hex, Money } from '../domain/money.ts';

export type { Hop };

export interface Transfer {
  readonly destinationChainId: number;
  readonly recipient: Address;
  readonly amount: Money;
  readonly payload?: Hex;
}

export interface CrossChainMessenger {
  send(transfer: Transfer): Promise<string>;
  track(messageId: string): AsyncIterable<Hop>;
}
