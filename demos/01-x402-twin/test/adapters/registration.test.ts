import type { Address } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import {
  IDENTITIES,
  type RoleIdentity,
  readIdentities,
  registerRoles,
  registrationUri,
} from '../../adapters/registration.ts';
import type { DemoState } from '../../state.ts';

const AGENT: Address = '0x7Ea1e5EF86548a506C81085099b356fD0B7B9EFC';
const SELLER: Address = '0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5';

function memory(initial?: unknown): DemoState & { readonly files: Map<string, unknown> } {
  const files = new Map<string, unknown>(initial === undefined ? [] : [[IDENTITIES, initial]]);
  return {
    dir: '/mem',
    files,
    read: <T>(name: string) => files.get(name) as T | undefined,
    write: (name, value) => void files.set(name, value),
  };
}

// A registry that remembers who owns which id.
function registry(first: bigint) {
  const owners = new Map<bigint, Address>();
  const sent: string[] = [];
  let next = first;
  const role = (address: Address): RoleIdentity => ({
    address,
    register: async (uri) => {
      sent.push(uri);
      owners.set(next, address);
      return next++;
    },
    ownerOf: async (id) => {
      const owner = owners.get(id);
      if (owner === undefined) throw new Error('ERC721NonexistentToken');
      return owner;
    },
  });
  return { sent, owners, roles: { agent: role(AGENT), seller: role(SELLER) } };
}

describe('registerRoles', () => {
  it('registers both roles once with distinct ids and stores them', async () => {
    const state = memory();
    const { roles, sent } = registry(10n);
    const report = await registerRoles(state, roles);
    expect(report).toEqual({ ids: { agent: 10n, seller: 11n }, registered: ['agent', 'seller'] });
    expect(sent).toHaveLength(2);
    expect(state.files.get(IDENTITIES)).toEqual({ agent: '10', seller: '11' });
  });

  it('prints the same ids on a rerun and sends no transaction', async () => {
    const state = memory();
    const { roles, sent } = registry(10n);
    await registerRoles(state, roles);
    sent.length = 0;
    expect(await registerRoles(state, roles)).toEqual({ ids: { agent: 10n, seller: 11n }, registered: [] });
    expect(sent).toEqual([]);
  });

  it('registers again an id the registry no longer knows (fresh fork) and an id owned by someone else', async () => {
    const state = memory({ agent: '5', seller: '6' });
    const { roles, owners } = registry(20n);
    owners.set(6n, AGENT);
    expect(await registerRoles(state, roles)).toEqual({
      ids: { agent: 20n, seller: 21n },
      registered: ['agent', 'seller'],
    });
    expect(readIdentities(state)).toEqual({ agent: 20n, seller: 21n });
  });

  it('registers only the role that is missing', async () => {
    const state = memory({ agent: '1' });
    const { roles, owners, sent } = registry(30n);
    owners.set(1n, AGENT);
    expect(await registerRoles(state, roles)).toEqual({ ids: { agent: 1n, seller: 30n }, registered: ['seller'] });
    expect(sent).toHaveLength(1);
  });
});

describe('registrationUri', () => {
  it('is a base64 data URI with registration-v1 JSON', () => {
    const uri = registrationUri('demo-1 seller', 'Demo 1 seller');
    expect(uri.startsWith('data:application/json;base64,')).toBe(true);
    const card = JSON.parse(Buffer.from(uri.split(',')[1] ?? '', 'base64').toString());
    expect(card).toMatchObject({
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'demo-1 seller',
      x402Support: true,
      active: true,
    });
  });
});

describe('readIdentities', () => {
  it('is empty without a file', () => {
    expect(readIdentities(memory())).toEqual({});
  });
});
