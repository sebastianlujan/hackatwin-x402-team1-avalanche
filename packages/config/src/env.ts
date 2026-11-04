import { z } from 'zod';

const required = { error: 'is required' } as const;

export const isRpcUrl = (value: string): boolean => {
  try {
    return /^(https?|wss?):$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const isLoopback = (value: string): boolean => LOOPBACK.has(new URL(value).hostname);

const rpcUrl = z.string(required).refine(isRpcUrl, 'must be an http(s) or ws(s) URL');
const forkRpcUrl = rpcUrl.refine(isLoopback, 'must be a loopback URL (localhost, 127.0.0.1 or [::1])');
const chainId = z
  .string(required)
  .regex(/^[1-9]\d*$/, 'must be a positive integer')
  .transform(Number)
  .refine(Number.isSafeInteger, 'must be a safe integer');
const keystore = z.string(required).regex(/^[A-Za-z0-9._-]+$/, 'must be a keystore name, not a path');
const passwordFile = z.string(required).regex(/^(\/|[A-Za-z]:[\\/])/, 'must be an absolute path');

export const envSchemas = {
  ANTHROPIC_API_KEY: z.string(required).min(1),
  CCHAIN_FORK_RPC_URL: forkRpcUrl,
  CCHAIN_RPC_URL: rpcUrl,
  ARBITRUM_RPC_URL: rpcUrl,
  BASE_RPC_URL: rpcUrl,
  FUJI_RPC_URL: rpcUrl,
  SEPOLIA_RPC_URL: rpcUrl,
  TWINPAY_L1_RPC_URL: rpcUrl,
  TWINPAY_L1_CHAIN_ID: chainId,
  AGENT_KEYSTORE: keystore,
  AGENT_KEYSTORE_PASSWORD_FILE: passwordFile,
  SELLER_KEYSTORE: keystore,
  SELLER_KEYSTORE_PASSWORD_FILE: passwordFile,
  FACILITATOR_KEYSTORE: keystore,
  FACILITATOR_KEYSTORE_PASSWORD_FILE: passwordFile,
  TREASURY_KEYSTORE: keystore,
  TREASURY_KEYSTORE_PASSWORD_FILE: passwordFile,
} as const;

export type EnvVariable = keyof typeof envSchemas;

export const ENV_VARIABLES = Object.keys(envSchemas) as EnvVariable[];
