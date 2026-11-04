import { money, token } from '@hackatwin/core';
import { z } from 'zod';
import { type EnvVariable, envSchemas } from './env.ts';

const llm = { provider: 'claude', model: 'claude-sonnet-5-5' } as const;
const budget = { perPayment: money(1_000_000n, 6, 'USD'), total: money(5_000_000n, 6, 'USD') } as const;

const pick = <K extends EnvVariable>(keys: readonly K[]) =>
  z.object(Object.fromEntries(keys.map((key) => [key, envSchemas[key]])) as { [P in K]: (typeof envSchemas)[P] });

const define = <const S, const K extends EnvVariable>(statics: S, keys: readonly K[]) => ({
  statics,
  schema: pick(['ANTHROPIC_API_KEY', ...keys]),
});

const roles = ['AGENT_KEYSTORE', 'AGENT_KEYSTORE_PASSWORD_FILE'] as const;
const withSeller = [
  ...roles,
  'SELLER_KEYSTORE',
  'SELLER_KEYSTORE_PASSWORD_FILE',
  'FACILITATOR_KEYSTORE',
  'FACILITATOR_KEYSTORE_PASSWORD_FILE',
] as const;

export const definitions = {
  'cchain-fork': define({ asset: 'ARGt', x402: 'permit2', facilitator: 'x402-ts' }, [
    'CCHAIN_FORK_RPC_URL',
    'CCHAIN_RPC_URL',
    'ARBITRUM_RPC_URL',
    'BASE_RPC_URL',
    ...withSeller,
  ]),
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
};

export type ProfileName = keyof typeof definitions;
export const PROFILE_NAMES = Object.keys(definitions) as ProfileName[];

export type Profile<N extends ProfileName = ProfileName> = N extends ProfileName
  ? {
      readonly name: N;
      readonly llm: typeof llm;
      readonly budget: typeof budget;
      readonly env: z.output<(typeof definitions)[N]['schema']>;
    } & (typeof definitions)[N]['statics']
  : never;

export const ProfileToken = token<Profile>('Profile');

export const staticValues = { llm, budget } as const;
