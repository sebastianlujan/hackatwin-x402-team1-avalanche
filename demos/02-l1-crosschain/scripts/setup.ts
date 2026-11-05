import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGuardedClients, type GuardedClients, localChain } from '@hackatwin/chains';
import { loadProfile } from '@hackatwin/config';
import { type Address, type ContractCall, formatMoney, type Hex, type Money, money } from '@hackatwin/core';
import {
  type Account,
  BaseError,
  decodeErrorResult,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiParameters,
} from 'viem';
import { parseWorld, type World } from '../deployment.ts';
import { BANNER } from '../labels.ts';

const USDC_DECIMALS = 6;
const AUTHORIZATION_TTL = 3600n;
const PROBE_AMOUNT = 2n ** 256n - 1n;
const PROBE_DEADLINE = 2n ** 40n;

const LANE_PARAMS = parseAbiParameters('(address token, address merchant, address messenger, bytes32 destination)');
const HUB_ABI = parseAbi([
  'error PaymentHub_LaneNotFound(bytes32 id)',
  'error PaymentHub_Unauthorized(address caller)',
  'error PaymentHub_BudgetExceeded(uint256 remaining, uint256 amount)',
  'function pay(bytes32 id, address onBehalf, uint256 amount, uint256 deadline) returns (bytes32)',
  'function nonces(address owner) view returns (uint256)',
  'function createLane((address token, address merchant, address messenger, bytes32 destination) params) returns (bytes32)',
  'function setAuthorizationWithSig((address authorizer, address authorized, address token, uint256 budget, uint256 nonce, uint256 deadline) authorization, bytes signature)',
]);
const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);
const AUTHORIZATION_TYPES = {
  Authorization: [
    { name: 'authorizer', type: 'address' },
    { name: 'authorized', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'budget', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export interface TypedData {
  readonly domain: { name: string; version: string; chainId: number; verifyingContract: Address };
  readonly types: typeof AUTHORIZATION_TYPES;
  readonly primaryType: 'Authorization';
  readonly message: {
    authorizer: Address;
    authorized: Address;
    token: Address;
    budget: bigint;
    nonce: bigint;
    deadline: bigint;
  };
}

// The hub chain as the treasury sees it; `write` waits for the receipt and throws on a revert.
export interface TreasuryChain {
  read<T>(call: ContractCall): Promise<T>;
  write(call: ContractCall): Promise<Hex>;
  revertData(call: ContractCall, from: Address): Promise<Hex | undefined>;
  signTypedData(typed: TypedData): Promise<Hex>;
  blockTimestamp(): Promise<bigint>;
}

export interface SetupProfile {
  readonly budget?: { readonly total?: Money };
}

export interface SetupInput {
  readonly chain: TreasuryChain;
  readonly world: World;
  readonly profile: SetupProfile;
  readonly print: (line: string) => void;
}

// The lane is missing, or the budget the broker still holds (0 when none was signed).
async function remainingBudget(chain: TreasuryChain, world: World, laneId: Hex): Promise<bigint | 'no-lane'> {
  const { treasury } = world.roles;
  const call = { address: world.contracts.hub, abi: HUB_ABI, functionName: 'pay' };
  const data = await chain.revertData(
    { ...call, args: [laneId, treasury, PROBE_AMOUNT, PROBE_DEADLINE] },
    world.contracts.broker,
  );
  if (data === undefined) throw new Error('the budget probe did not revert');
  const error = decodeErrorResult({ abi: HUB_ABI, data });
  if (error.errorName === 'PaymentHub_LaneNotFound') return 'no-lane';
  if (error.errorName === 'PaymentHub_Unauthorized') return 0n;
  return error.args[0];
}

export async function setupTreasury({ chain, world, profile, print }: SetupInput) {
  const total = profile.budget?.total;
  if (total === undefined) throw new Error('the profile has no budget.total');
  print(BANNER);
  const { usdc, hub, broker, messenger } = world.contracts;
  const { treasury, merchant } = world.roles;
  const params = { token: usdc, merchant, messenger, destination: world.chains.l1.blockchainId };
  const laneId = keccak256(encodeAbiParameters(LANE_PARAMS, [params]));

  let remaining = await remainingBudget(chain, world, laneId);
  if (remaining === 'no-lane') {
    await chain.write({ address: hub, abi: HUB_ABI, functionName: 'createLane', args: [params] });
    remaining = await remainingBudget(chain, world, laneId);
  }
  const allowance = await chain.read<bigint>({
    address: usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [treasury, hub],
  });
  if (allowance < total.units) {
    await chain.write({ address: usdc, abi: ERC20_ABI, functionName: 'approve', args: [hub, total.units] });
  }
  if (remaining === 0n) {
    const nonce = await chain.read<bigint>({ address: hub, abi: HUB_ABI, functionName: 'nonces', args: [treasury] });
    const message = {
      authorizer: treasury,
      authorized: broker,
      token: usdc,
      budget: total.units,
      nonce,
      deadline: (await chain.blockTimestamp()) + AUTHORIZATION_TTL,
    };
    const domain = { name: 'PaymentHub', version: '1', chainId: world.chains.hub.chainId, verifyingContract: hub };
    const signature = await chain.signTypedData({
      domain,
      types: AUTHORIZATION_TYPES,
      primaryType: 'Authorization',
      message,
    });
    await chain.write({
      address: hub,
      abi: HUB_ABI,
      functionName: 'setAuthorizationWithSig',
      args: [message, signature],
    });
    remaining = await remainingBudget(chain, world, laneId);
  }
  if (typeof remaining !== 'bigint') throw new Error('the lane is missing after creation');
  print(`lane: ${laneId}`);
  print(`remaining budget: ${formatMoney(money(remaining, USDC_DECIMALS, 'USDC'))}`);
  return { laneId, remaining };
}

// Anvil puts the revert data on the RPC error at the bottom of the cause chain.
const revertDataOf = (error: unknown): Hex => {
  const rpc =
    error instanceof BaseError ? error.walk((e) => typeof (e as { data?: unknown }).data === 'string') : undefined;
  const data = (rpc as { data?: unknown } | null | undefined)?.data;
  if (typeof data === 'string') return data as Hex;
  throw error;
};

export function treasuryChain(clients: GuardedClients, account: Account): TreasuryChain {
  const client = clients.chainClient(account);
  const wallet = clients.wallet(account);
  return {
    read: async <T>(call: ContractCall) => (await client.read<T>(call)).value,
    async write(call) {
      const receipt = await client.waitForReceipt(await client.write(call));
      if (receipt.status !== 'success') throw new Error(`${call.functionName} reverted in ${receipt.txHash}`);
      return receipt.txHash;
    },
    async revertData(call, from) {
      const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args } as never);
      try {
        await clients.public.call({ account: from, to: call.address, data });
        return undefined;
      } catch (error) {
        return revertDataOf(error);
      }
    },
    signTypedData: (typed) => wallet.signTypedData(typed),
    blockTimestamp: async () => (await clients.public.getBlock()).timestamp,
  };
}

if (import.meta.main) {
  const dir = join(import.meta.dirname, '../../../.cache/local-crosschain/dev');
  const world = parseWorld(JSON.parse(readFileSync(join(dir, 'world.json'), 'utf8')));
  const profile = loadProfile('local-crosschain');
  const { chainId } = world.chains.hub;
  const hub = localChain('local-hub', { chainId, rpcUrl: profile.env.LOCAL_HUB_RPC_URL });
  const clients = await createGuardedClients({ chain: hub, rpcUrl: hub.rpcUrl });
  const treasury = { address: world.roles.treasury, type: 'json-rpc' } as Account;
  await setupTreasury({ chain: treasuryChain(clients, treasury), world, profile, print: console.log });
  process.exit(0);
}
