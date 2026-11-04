import type { GuardedClients } from '@hackatwin/chains';
import { type Address, type Money, money, type PriceOracle } from '@hackatwin/core';
import type { Account } from 'viem';
import type { DemoState } from '../state.ts';

const AVAX = 10n ** 18n;
export const MIN_GAS_WEI = AVAX;
export const TOP_UP_GAS_WEI = 10n * AVAX;

const fn = (name: string, inputs: readonly string[], stateMutability: 'view' | 'nonpayable', output?: string) =>
  ({
    type: 'function',
    name,
    stateMutability,
    inputs: inputs.map((type) => ({ name: '', type })),
    outputs: output === undefined ? [] : [{ name: '', type: output }],
  }) as const;
const ARGT_ABI = [
  fn('balanceOf', ['address'], 'view', 'uint256'),
  fn('allowance', ['address', 'address'], 'view', 'uint256'),
  fn('approve', ['address', 'uint256'], 'nonpayable', 'bool'),
  fn('mint', ['address', 'uint256'], 'nonpayable'),
];

export class FundingError extends Error {
  override readonly name = 'FundingError';
}

// The writes funding needs; the live implementation signs only through guarded fork clients.
export interface FundingChain {
  gas(address: Address): Promise<bigint>;
  setGas(address: Address, wei: bigint): Promise<void>;
  balance(owner: Address): Promise<bigint>;
  allowance(owner: Address): Promise<bigint>;
  mint(to: Address, amount: bigint): Promise<void>;
  approve(amount: bigint): Promise<void>;
}

export interface FundingRecord {
  readonly forkBlock: string;
  readonly target: string;
}

export interface FundingOptions {
  readonly chain: FundingChain;
  readonly oracle: PriceOracle;
  readonly state: DemoState;
  readonly budgetTotal: Money;
  readonly forkBlock: bigint;
  readonly agent: Address;
  readonly gasFor: readonly Address[];
}

export interface FundingReport {
  readonly target: bigint;
  readonly gasToppedUp: readonly Address[];
  readonly minted: bigint;
  readonly approved: boolean;
}

const RECORD = 'funding.json';

// Target T is the guarded quote of twice the budget, recorded once per fork block.
async function targetFor({ state, oracle, budgetTotal, forkBlock }: FundingOptions): Promise<bigint> {
  const recorded = state.read<FundingRecord>(RECORD);
  if (recorded?.forkBlock === String(forkBlock)) return BigInt(recorded.target);
  const double = money(budgetTotal.units * 2n, budgetTotal.decimals, budgetTotal.currency);
  const target = (await oracle.quote(double, 'ARGt')).amount.units;
  state.write(RECORD, { forkBlock: String(forkBlock), target: String(target) } satisfies FundingRecord);
  return target;
}

export async function fund(options: FundingOptions): Promise<FundingReport> {
  const { chain, agent, gasFor } = options;
  const target = await targetFor(options);
  const gasToppedUp: Address[] = [];
  for (const address of gasFor) {
    if ((await chain.gas(address)) >= MIN_GAS_WEI) continue;
    await chain.setGas(address, TOP_UP_GAS_WEI);
    gasToppedUp.push(address);
  }
  const held = await chain.balance(agent);
  const minted = held < target ? target - held : 0n;
  if (minted > 0n) await chain.mint(agent, minted);
  const approved = (await chain.allowance(agent)) < target;
  if (approved) await chain.approve(target);
  const [balance, allowance] = [await chain.balance(agent), await chain.allowance(agent)];
  if (balance < target) throw new FundingError(`balance ${balance} is below the target ${target}`);
  if (allowance !== target) throw new FundingError(`allowance ${allowance} does not equal the target ${target}`);
  return { target, gasToppedUp, minted, approved };
}

export interface FundingChainOptions {
  readonly fork: GuardedClients;
  readonly token: Address;
  readonly permit2: Address;
  readonly adapter: Address;
  readonly agent: Account;
}

export function createFundingChain({ fork, token, permit2, adapter, agent }: FundingChainOptions): FundingChain {
  const cheats = fork.cheats();
  const reader = fork.chainClient();
  const read = async (functionName: string, args: readonly unknown[]): Promise<bigint> =>
    (await reader.read<bigint>({ address: token, abi: ARGT_ABI, functionName, args })).value;
  const send = async (from: Account, functionName: string, args: readonly unknown[]): Promise<void> => {
    const client = fork.chainClient(from);
    const receipt = await client.waitForReceipt(
      await client.write({ address: token, abi: ARGT_ABI, functionName, args }),
    );
    if (receipt.status !== 'success') throw new FundingError(`${functionName} reverted`);
  };
  return {
    gas: (address) => fork.public.getBalance({ address }),
    setGas: (address, wei) => cheats.setBalance(address, wei),
    balance: (owner) => read('balanceOf', [owner]),
    allowance: (owner) => read('allowance', [owner, permit2]),
    async mint(to, amount) {
      await cheats.impersonate(adapter);
      try {
        await send({ address: adapter, type: 'json-rpc' }, 'mint', [to, amount]);
      } finally {
        await cheats.stopImpersonating(adapter);
      }
    },
    approve: (amount) => send(agent, 'approve', [permit2, amount]),
  };
}
