import type { Address } from '@hackatwin/core';
import type { DemoState } from '../state.ts';

export const IDENTITIES = 'identities.json';
export const REGISTRATION_ROLES = ['agent', 'seller'] as const;
export type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

// The two calls registration needs from the identity adapter.
export interface RoleIdentity {
  readonly address: Address;
  register(agentUri: string): Promise<bigint>;
  ownerOf(agentId: bigint): Promise<Address>;
}

export interface RegistrationReport {
  readonly ids: Readonly<Record<RegistrationRole, bigint>>;
  readonly registered: readonly RegistrationRole[];
}

type Stored = Partial<Record<RegistrationRole, string>>;

// ERC-8004 registration-v1 JSON as a base64 data URI, so no hosting is needed.
export function registrationUri(name: string, description: string): string {
  const card = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name,
    description,
    services: [],
    x402Support: true,
    active: true,
  };
  return `data:application/json;base64,${Buffer.from(JSON.stringify(card)).toString('base64')}`;
}

export function readIdentities(state: DemoState): Partial<Record<RegistrationRole, bigint>> {
  const stored = state.read<Stored>(IDENTITIES) ?? {};
  return Object.fromEntries(
    REGISTRATION_ROLES.flatMap((role) => (stored[role] === undefined ? [] : [[role, BigInt(stored[role])]])),
  );
}

// A stored id counts only while the registry still says this role owns it (a fresh fork forgets it).
async function stillOwned(identity: RoleIdentity, id: bigint): Promise<boolean> {
  try {
    return (await identity.ownerOf(id)).toLowerCase() === identity.address.toLowerCase();
  } catch {
    return false;
  }
}

export async function registerRoles(
  state: DemoState,
  roles: Readonly<Record<RegistrationRole, RoleIdentity>>,
): Promise<RegistrationReport> {
  const known = readIdentities(state);
  const ids: Partial<Record<RegistrationRole, bigint>> = {};
  const registered: RegistrationRole[] = [];
  for (const role of REGISTRATION_ROLES) {
    const identity = roles[role];
    const id = known[role];
    if (id !== undefined && (await stillOwned(identity, id))) {
      ids[role] = id;
      continue;
    }
    ids[role] = await identity.register(registrationUri(`demo-1 ${role}`, `Demo 1 ${role} on the C-Chain fork`));
    registered.push(role);
  }
  if (registered.length > 0) {
    state.write(IDENTITIES, Object.fromEntries(REGISTRATION_ROLES.map((role) => [role, String(ids[role])])));
  }
  return { ids: ids as Record<RegistrationRole, bigint>, registered };
}
