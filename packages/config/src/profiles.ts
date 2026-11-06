import { money } from '@hackatwin/core';
import { z } from 'zod';
import { type EnvVariable, envSchemas } from './env.ts';

export type LlmConfig = { readonly provider: 'claude'; readonly model: string } | { readonly provider: 'scripted' };
export type LlmProvider = LlmConfig['provider'];

const claude = { provider: 'claude', model: 'claude-sonnet-5-5' } as const;
const budget = { perPayment: money(1_000_000n, 6, 'USD'), total: money(5_000_000n, 6, 'USD') } as const;

const pick = <K extends EnvVariable>(keys: readonly K[]) =>
  z.object(Object.fromEntries(keys.map((key) => [key, envSchemas[key]])) as { [P in K]: (typeof envSchemas)[P] });

const define = <const S, const K extends EnvVariable>(statics: S, keys: readonly K[]) => ({
  statics,
  schema: pick(['KEYSTORE_DIR', ...keys]),
});

// The pinned executed block N of the C-Chain fork, printed by `pnpm demo1:fork-block`.
export const CCHAIN_FORK_BLOCK = 99_388_000n;

export const forkStaticsSchema = z.object({ forkBlock: z.bigint().positive() });

// Chain IDs of Fuji, the C-Chain and Sepolia: a local profile must never claim one.
const LIVE_CHAIN_IDS = [43113, 43114, 11155111];
const localChainId = z
  .number()
  .int()
  .positive()
  .refine((id) => !LIVE_CHAIN_IDS.includes(id), 'must not be a live chain ID');

export const localStaticsSchema = z.object({ hubChainId: localChainId, l1ChainId: localChainId });

const roles = ['AGENT_KEYSTORE', 'AGENT_KEYSTORE_PASSWORD_FILE'] as const;
const withSeller = [
  ...roles,
  'SELLER_KEYSTORE',
  'SELLER_KEYSTORE_PASSWORD_FILE',
  'FACILITATOR_KEYSTORE',
  'FACILITATOR_KEYSTORE_PASSWORD_FILE',
] as const;

export const definitions = {
  'cchain-fork': define(
    {
      asset: 'ARGt',
      x402: 'permit2',
      facilitator: 'x402-ts',
      ...forkStaticsSchema.parse({ forkBlock: CCHAIN_FORK_BLOCK }),
    },
    ['CCHAIN_FORK_RPC_URL', 'CCHAIN_RPC_URL', 'ARBITRUM_RPC_URL', 'BASE_RPC_URL', ...withSeller],
  ),
  'fuji-crosschain': define({ asset: 'USDC', x402: 'none' }, [
    'SEPOLIA_RPC_URL',
    'FUJI_RPC_URL',
    'TWINPAY_L1_RPC_URL',
    'TWINPAY_L1_CHAIN_ID',
    ...roles,
    'TREASURY_KEYSTORE',
    'TREASURY_KEYSTORE_PASSWORD_FILE',
  ]),
  'twinpay-l1': define({ asset: 'USDC', x402: 'permit2', facilitator: 'x402-ts' }, [
    'TWINPAY_L1_RPC_URL',
    'TWINPAY_L1_CHAIN_ID',
    'FUJI_RPC_URL',
    'ARBITRUM_RPC_URL',
    'BASE_RPC_URL',
    ...withSeller,
  ]),
  'fuji-cchain': define({ asset: 'USDC', x402: 'eip3009', facilitator: 'x402-ts' }, [
    'FUJI_RPC_URL',
    'ARBITRUM_RPC_URL',
    'BASE_RPC_URL',
    ...withSeller,
  ]),
  'local-crosschain': define(
    { ccip: 'simulated', ...localStaticsSchema.parse({ hubChainId: 31337, l1ChainId: 31338 }) },
    ['LOCAL_HUB_RPC_URL', 'LOCAL_L1_RPC_URL'],
  ),
};

export type ProfileName = keyof typeof definitions;
export const PROFILE_NAMES = Object.keys(definitions) as ProfileName[];

export type Profile<N extends ProfileName = ProfileName> = N extends ProfileName
  ? {
      readonly name: N;
      readonly llm?: LlmConfig;
      readonly budget: typeof budget;
      readonly env: z.output<(typeof definitions)[N]['schema']> & { readonly ANTHROPIC_API_KEY?: string };
    } & (typeof definitions)[N]['statics']
  : never;

export const staticValues = { budget } as const;
export const llmConfig = (provider: LlmProvider): LlmConfig => (provider === 'claude' ? claude : { provider });
