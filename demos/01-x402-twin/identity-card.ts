import type { Address, Reputation } from '@hackatwin/core';
import { REGISTRATION_ROLES, type RegistrationRole, readIdentities } from './adapters/registration.ts';
import { forkIdentity } from './buyer-agent/entry.ts';
import { composeRoot, type Root, type RootOptions } from './root.ts';
import type { DemoState } from './state.ts';
import { Tokens } from './tokens.ts';

export interface IdentityReader {
  ownerOf(agentId: bigint): Promise<Address>;
  reputation(agentId: bigint): Promise<Reputation>;
}

export interface Demo1Identity {
  readonly role: RegistrationRole;
  readonly agentId: bigint;
  readonly owner: Address;
  // Undefined when the reputation registry could not be read.
  readonly reputation: Reputation | undefined;
}

export class IdentityUnavailableError extends Error {
  override readonly name = 'IdentityUnavailableError';
}

// Ids come from the demo state and owners from the registry; any failure but the reputation read throws.
export async function readIdentityCard(state: DemoState, registry: IdentityReader): Promise<readonly Demo1Identity[]> {
  const ids = readIdentities(state);
  return Promise.all(
    REGISTRATION_ROLES.map(async (role): Promise<Demo1Identity> => {
      const agentId = ids[role];
      if (agentId === undefined)
        throw new IdentityUnavailableError(`${role} is not registered: run pnpm demo1:register`);
      const owner = await registry.ownerOf(agentId);
      const reputation = await registry.reputation(agentId).catch(() => undefined);
      return { role, agentId, owner, reputation };
    }),
  );
}

export interface ReadIdentitiesOptions {
  readonly stateDir?: string;
  readonly compose?: (options: RootOptions) => Promise<Root>;
}

// Composes the fork root, reads the card, and always disposes the root.
export async function readDemo1Identities({
  stateDir,
  compose = composeRoot,
}: ReadIdentitiesOptions = {}): Promise<readonly Demo1Identity[]> {
  const root = await compose(stateDir === undefined ? {} : { stateDir });
  try {
    return await readIdentityCard(root.container.resolve(Tokens.State), forkIdentity(root));
  } finally {
    await root.container.dispose();
  }
}
