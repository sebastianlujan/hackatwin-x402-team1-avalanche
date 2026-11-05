import type { Address, Hex } from '@hackatwin/core';
import { z } from 'zod';

const address = z.custom<Address>((v) => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v), 'must be an address');
const bytes32 = z.custom<Hex>((v) => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v), 'must be 32 bytes');
const chain = <K extends string>(key: K) =>
  z.object({ key: z.literal(key), chainId: z.number().int(), rpcUrl: z.string(), blockchainId: bytes32 });

// The slice of `world.json` (written by `up.ts`) that the demo reads.
const worldSchema = z.object({
  version: z.literal(1),
  instance: z.string(),
  chains: z.object({ hub: chain('local-hub'), l1: chain('local-l1') }),
  contracts: z.object({
    usdc: address,
    hub: address,
    broker: address,
    messenger: address,
    receiver: address,
    router: address,
  }),
  roles: z.object({ treasury: address, agent: address, merchant: address }),
});

export type World = z.output<typeof worldSchema>;

export function parseWorld(json: unknown): World {
  const result = worldSchema.safeParse(json);
  if (result.success) return result.data;
  throw new Error(`world.json: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
}
