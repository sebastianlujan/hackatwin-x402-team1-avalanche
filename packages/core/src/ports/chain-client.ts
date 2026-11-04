import type { Address, Hex } from '../domain/money.ts';

export interface ContractCall {
  readonly address: Address;
  readonly abi: readonly unknown[];
  readonly functionName: string;
  readonly args?: readonly unknown[];
}

export interface Log {
  readonly address: Address;
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

export interface Receipt {
  readonly txHash: Hex;
  readonly status: 'success' | 'reverted';
  readonly blockNumber: bigint;
  readonly logs: readonly Log[];
}

export interface ChainClient {
  readonly chainId: number;
  read<T>(call: ContractCall): Promise<T>;
  write(call: ContractCall): Promise<Hex>;
  waitForReceipt(txHash: Hex): Promise<Receipt>;
}
