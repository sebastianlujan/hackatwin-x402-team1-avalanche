import type { Address } from '@hackatwin/core';
import { getAddress } from 'viem';
import { arbitrum, avalanche, avalancheFuji, base, type Chain, sepolia } from 'viem/chains';
import { z } from 'zod';
import arbitrumJson from '../registry/arbitrum.json' with { type: 'json' };
import baseJson from '../registry/base.json' with { type: 'json' };
import cchainJson from '../registry/cchain.json' with { type: 'json' };
import fujiJson from '../registry/fuji.json' with { type: 'json' };
import sepoliaJson from '../registry/sepolia.json' with { type: 'json' };
import twinpayL1Json from '../registry/twinpay-l1.json' with { type: 'json' };
import { ChainError } from './chain-error.ts';

const address = z
  .string()
  .refine((value) => /^0x[0-9a-fA-F]{40}$/.test(value) && getAddress(value) === value, 'must be an EIP-55 address')
  .transform((value) => value as Address);
const source = z
  .string()
  .refine((v) => v.startsWith('https://') || v.startsWith('read: '), 'must be https:// or read: ');
const check = z.strictObject({ call: z.string(), args: z.array(z.string()).optional(), expect: z.string().optional() });
const contract = z.strictObject({
  address,
  source,
  checks: z.array(check).optional(),
  heartbeatSeconds: z.number().int().positive().optional(),
});
const live = z.strictObject({
  key: z.string(),
  name: z.string(),
  status: z.literal('live'),
  chainId: z.number().int().positive(),
  access: z.enum(['read-only', 'fork-only', 'read-write']),
  rpc: z.strictObject({ public: z.url() }),
  ccip: z.strictObject({ chainSelector: z.string().regex(/^\d+$/) }).optional(),
  contracts: z.record(z.string(), contract),
});
const planned = z.strictObject({
  key: z.string(),
  name: z.string(),
  status: z.literal('planned'),
  contracts: z.strictObject({}),
});
const entry = z.discriminatedUnion('status', [live, planned]);

export type ContractEntry = z.infer<typeof contract>;
export type ContractCheck = z.infer<typeof check>;
export type LiveChain = z.infer<typeof live>;
export type PlannedChain = {
  readonly key: string;
  readonly name: string;
  readonly status: 'planned';
  readonly contracts: Readonly<Record<string, never>>;
  readonly chainId?: undefined;
  readonly rpc?: undefined;
};
export type ChainEntry = LiveChain | PlannedChain;

export function parseChain(raw: unknown, file = 'registry'): ChainEntry {
  const result = entry.safeParse(raw);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new ChainError(`${file}: ${issues.join('; ')}`);
}

const RAW = {
  cchain: cchainJson,
  fuji: fujiJson,
  sepolia: sepoliaJson,
  'twinpay-l1': twinpayL1Json,
  arbitrum: arbitrumJson,
  base: baseJson,
};

const entries: readonly ChainEntry[] = Object.entries(RAW).map(([file, raw]) => {
  const parsed = parseChain(raw, file);
  if (parsed.key !== file) throw new ChainError(`${file}: key "${parsed.key}" must match the file name`);
  return parsed;
});

const VIEM: Readonly<Record<number, Chain>> = {
  43114: avalanche,
  43113: avalancheFuji,
  11155111: sepolia,
  42161: arbitrum,
  8453: base,
};

export const listChains = (): readonly ChainEntry[] => entries;

export function chain(key: string): ChainEntry {
  const found = entries.find((candidate) => candidate.key === key);
  if (found === undefined)
    throw new ChainError(`unknown chain "${key}", use one of: ${entries.map((e) => e.key).join(', ')}`);
  return found;
}

export function toViemChain(key: string): Chain {
  const { chainId } = chain(key);
  const viem = chainId === undefined ? undefined : VIEM[chainId];
  if (viem === undefined) throw new ChainError(`chain "${key}" has no viem chain (not deployed)`);
  return viem;
}
