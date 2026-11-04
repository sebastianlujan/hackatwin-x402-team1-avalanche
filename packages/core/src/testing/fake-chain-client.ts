import type { Address, Hex } from '../domain/money.ts';
import type { ChainClient, ContractCall, Log, ReadOptions, ReadResult, Receipt } from '../ports/chain-client.ts';

export interface FakeChainOptions {
  readonly chainId?: number;
  readonly blockNumber?: bigint;
  readonly reads?: Readonly<Record<string, unknown>>;
  readonly logs?: readonly Log[];
}

export interface RecordedRead {
  readonly call: ContractCall;
  readonly blockNumber: bigint | undefined;
}

const show = (arg: unknown): string =>
  typeof arg === 'string' || typeof arg === 'bigint'
    ? String(arg)
    : JSON.stringify(arg, (_, v) => (typeof v === 'bigint' ? v.toString() : v));

// Script key for a read: `address:functionName(arg1,arg2)`, bigints as decimal.
export const readKey = (address: Address, functionName: string, args: readonly unknown[] = []): string =>
  `${address}:${functionName}(${args.map(show).join(',')})`;

export class FakeChainClient implements ChainClient {
  readonly chainId: number;
  readonly writes: ContractCall[] = [];
  readonly calls: RecordedRead[] = [];
  private readonly head: bigint;
  private readonly reads: Readonly<Record<string, unknown>>;
  private readonly logs: readonly Log[];

  constructor(options: FakeChainOptions = {}) {
    this.chainId = options.chainId ?? 31337;
    this.head = options.blockNumber ?? 1n;
    this.reads = options.reads ?? {};
    this.logs = options.logs ?? [];
  }

  async blockNumber(): Promise<bigint> {
    return this.head;
  }

  async read<T>(call: ContractCall, options: ReadOptions = {}): Promise<ReadResult<T>> {
    this.calls.push({ call, blockNumber: options.blockNumber });
    const key = readKey(call.address, call.functionName, call.args);
    if (!(key in this.reads)) {
      throw new Error(
        `FakeChainClient has no read for ${key} (address ${call.address}, function ${call.functionName})`,
      );
    }
    const value = this.reads[key];
    if (value instanceof Error) throw value;
    return { value: value as T, blockNumber: options.blockNumber ?? this.head };
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
