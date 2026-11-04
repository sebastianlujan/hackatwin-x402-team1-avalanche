export type Access = 'read-only' | 'fork-only' | 'read-write';

export interface WriteTarget {
  readonly chainId: number;
  readonly access: Access;
  readonly rpcUrl: string;
  readonly clientVersion?: string;
}

const FORK_CHAIN_ID = 43114;
const NEVER_WRITE = new Set([42161, 8453]);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export const isLoopback = (url: string): boolean => {
  try {
    return LOOPBACK.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

// Only a loopback C-Chain RPC needs the anvil probe; every other case is decided without a call.
export const needsClientVersion = (chainId: number, rpcUrl: string): boolean =>
  chainId === FORK_CHAIN_ID && isLoopback(rpcUrl);

// Returns why writes are refused, or undefined when they are allowed.
export function writeRefusal({ chainId, access, rpcUrl, clientVersion }: WriteTarget): string | undefined {
  if (access === 'read-only' || NEVER_WRITE.has(chainId)) return `chain ${chainId} is read-only`;
  if (chainId === FORK_CHAIN_ID || access === 'fork-only') {
    if (!isLoopback(rpcUrl)) return `chain ${chainId} writes need a loopback anvil fork, this RPC is not loopback`;
    if (!/anvil/i.test(clientVersion ?? '')) return `chain ${chainId} writes need anvil, this RPC does not report it`;
  }
  return undefined;
}
