import { type Chain, defineChain } from 'viem';
import { ChainError } from './chain-error.ts';
import { isLoopback } from './write-guard.ts';

export type LocalChainKey = 'local-hub' | 'local-l1';

// A dev-only chain on a plain anvil: not in the registry, never has an explorer.
export interface LocalChain {
  readonly key: LocalChainKey;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly access: 'fork-only';
  readonly mode: 'plain';
}

const KEYS: ReadonlySet<string> = new Set<LocalChainKey>(['local-hub', 'local-l1']);
// Fuji, C-Chain, Sepolia, Arbitrum One and Base: a local node must never claim a live network's ID.
const LIVE_CHAIN_IDS: ReadonlySet<number> = new Set([43113, 43114, 11155111, 42161, 8453]);

export const isLocalChainKey = (key: string): key is LocalChainKey => KEYS.has(key);

// The RPC URL is never echoed: it may carry a key.
export function assertLocalChain({ key, chainId, rpcUrl }: LocalChain): void {
  if (!isLocalChainKey(key)) throw new ChainError(`"${key}" is not a local chain key`);
  if (!Number.isInteger(chainId) || chainId <= 0)
    throw new ChainError(`local chain "${key}" chain ID ${chainId} is invalid`);
  if (LIVE_CHAIN_IDS.has(chainId)) throw new ChainError(`local chain "${key}" must not use live chain ID ${chainId}`);
  if (!isLoopback(rpcUrl)) throw new ChainError(`local chain "${key}" RPC URL is not loopback`);
}

export function localChain(key: LocalChainKey, { chainId, rpcUrl }: { chainId: number; rpcUrl: string }): LocalChain {
  const chain: LocalChain = { key, chainId, rpcUrl, access: 'fork-only', mode: 'plain' };
  assertLocalChain(chain);
  return chain;
}

export const toViemLocalChain = ({ key, chainId, rpcUrl }: LocalChain): Chain =>
  defineChain({
    id: chainId,
    name: key,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
