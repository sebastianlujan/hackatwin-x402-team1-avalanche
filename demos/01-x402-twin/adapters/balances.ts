import type { Address, ChainClient } from '@hackatwin/core';

const BALANCE_OF = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export interface BalanceSnapshot {
  readonly agent: bigint;
  readonly seller: bigint;
}

export interface Balances {
  read(): Promise<BalanceSnapshot>;
}

export interface BalancesOptions {
  readonly chain: ChainClient;
  readonly token: Address;
  readonly agent: Address;
  readonly seller: Address;
}

// ARGt balances of the two parties, in base units.
export function createBalances({ chain, token, agent, seller }: BalancesOptions): Balances {
  const of = async (owner: Address): Promise<bigint> =>
    (await chain.read<bigint>({ address: token, abi: BALANCE_OF, functionName: 'balanceOf', args: [owner] })).value;
  return { read: async () => ({ agent: await of(agent), seller: await of(seller) }) };
}
