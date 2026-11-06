import type { Address, Reputation } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { IdentityUnavailableError, readDemo1Identities, readIdentityCard } from '../identity-card.ts';
import type { DemoState } from '../state.ts';

const owner = (n: number): Address => `0x${String(n).repeat(40)}`;
const stateWith = (ids: Record<string, string>): DemoState => ({
  dir: '/mem',
  read: <T>() => ids as T,
  write: () => undefined,
});
const score: Reputation = { agentId: 1851n, count: 1n, value: 100n, valueDecimals: 0 };
const registry = (overrides: Partial<Parameters<typeof readIdentityCard>[1]> = {}) => ({
  ownerOf: async (id: bigint) => owner(id === 1850n ? 1 : 2),
  reputation: async () => score,
  ...overrides,
});

describe('readIdentityCard', () => {
  it('reads the agent and seller ids from state with their owners and reputation', async () => {
    const rows = await readIdentityCard(stateWith({ agent: '1850', seller: '1851' }), registry());
    expect(rows).toEqual([
      { role: 'agent', agentId: 1850n, owner: owner(1), reputation: score },
      { role: 'seller', agentId: 1851n, owner: owner(2), reputation: score },
    ]);
  });

  it('leaves the reputation undefined when it cannot be read, and keeps the ids', async () => {
    const reader = registry({
      reputation: async () => {
        throw new Error('reverted');
      },
    });
    const rows = await readIdentityCard(stateWith({ agent: '1850', seller: '1851' }), reader);
    expect(rows.map((row) => row.reputation)).toEqual([undefined, undefined]);
    expect(rows.map((row) => row.agentId)).toEqual([1850n, 1851n]);
  });

  it('fails when a role is not registered or the owner cannot be read', async () => {
    await expect(readIdentityCard(stateWith({ agent: '1850' }), registry())).rejects.toThrow(IdentityUnavailableError);
    const down = registry({
      ownerOf: async () => {
        throw new Error('fetch failed');
      },
    });
    await expect(readIdentityCard(stateWith({ agent: '1850', seller: '1851' }), down)).rejects.toThrow('fetch failed');
  });
});

describe('readDemo1Identities', () => {
  it('disposes the root even when the read fails', async () => {
    let disposed = false;
    const root = {
      container: {
        resolve: () => stateWith({}),
        dispose: async () => {
          disposed = true;
        },
      },
    } as never;
    await expect(readDemo1Identities({ compose: async () => root })).rejects.toThrow();
    expect(disposed).toBe(true);
  });

  it('passes the compose error through when the fork is unreachable', async () => {
    const compose = async () => {
      throw new Error('fetch failed');
    };
    await expect(readDemo1Identities({ compose })).rejects.toThrow('fetch failed');
  });
});
