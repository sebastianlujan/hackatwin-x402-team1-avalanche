import type { Hex } from '../domain/money.ts';
import type { ChainClient, ContractCall, Log, Receipt } from '../ports/chain-client.ts';

export interface FakeChainOptions {
  readonly chainId?: number;
  readonly reads?: Readonly<Record<string, unknown>>;
  readonly logs?: readonly Log[];
}

export class FakeChainClient implements ChainClient {
  readonly chainId: number;
  readonly writes: ContractCall[] = [];
  private readonly reads: Readonly<Record<string, unknown>>;
  private readonly logs: readonly Log[];

  constructor(options: FakeChainOptions = {}) {
    this.chainId = options.chainId ?? 31337;
    this.reads = options.reads ?? {};
    this.logs = options.logs ?? [];
  }

  async read<T>(call: ContractCall): Promise<T> {
    const key = `${call.address}:${call.functionName}`;
    if (!(key in this.reads)) throw new Error(`FakeChainClient has no read for ${key}`);
    return this.reads[key] as T;
  }

  async write(call: ContractCall): Promise<Hex> {
    this.writes.push(call);
    return `0x${this.writes.length.toString(16).padStart(64, '0')}`;
  }

  async waitForReceipt(txHash: Hex): Promise<Receipt> {
    const index = Number.parseInt(txHash, 16);
    if (!(index >= 1 && index <= this.writes.length)) throw new Error(`Unknown transaction ${txHash}`);
    return { txHash, status: 'success', blockNumber: BigInt(index), logs: this.logs };
  }
}
