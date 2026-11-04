import { chain, toViemChain } from './registry.ts';

const HASH = /^0x[0-9a-fA-F]{64}$/;

// An explorer link exists only for a live read-write chain (never a fork) and a well-formed hash.
export function txUrl(key: string, hash: string): string | undefined {
  const entry = chain(key);
  if (entry.status !== 'live' || entry.access !== 'read-write' || !HASH.test(hash)) return undefined;
  const base = toViemChain(key).blockExplorers?.default.url;
  return base === undefined ? undefined : `${base.replace(/\/+$/, '')}/tx/${hash}`;
}
