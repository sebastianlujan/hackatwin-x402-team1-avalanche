import type { Hex } from '@hackatwin/core';
import { decodeAbiParameters, encodeAbiParameters, hexToBigInt, keccak256, size } from 'viem';
import { describe, expect, it } from 'vitest';
import { laneIdOf, paymentPayload } from './lane.ts';
import { a, world } from './world.fixtures.ts';

const independent = (merchant: Hex, destination: Hex): Hex =>
  keccak256(
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'bytes32' }],
        },
      ],
      [[a(1), merchant, a(4), destination]],
    ),
  );

describe('laneIdOf', () => {
  it('hashes the token, merchant, messenger and L1 blockchain ID', () => {
    expect(laneIdOf(world)).toBe(independent(a(9), world.chains.l1.blockchainId));
  });

  it('changes with the merchant', () => {
    const other = { ...world, roles: { ...world.roles, merchant: a(12) } };
    expect(laneIdOf(other)).toBe(independent(a(12), world.chains.l1.blockchainId));
    expect(laneIdOf(other)).not.toBe(laneIdOf(world));
  });
});

describe('paymentPayload', () => {
  const lane = laneIdOf(world);
  const decode = (payload: Hex) =>
    decodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], payload);

  it('encodes the lane, payer, amount and deadline in 128 bytes', () => {
    const payload = paymentPayload({ lane, payer: a(7), amount: 1_000_000n, deadline: 1_700_003_600n });
    expect(size(payload)).toBe(128);
    expect(decode(payload)).toEqual([lane, hexToBigInt(a(7)), 1_000_000n, 1_700_003_600n]);
  });

  it('carries other values unchanged', () => {
    const payload = paymentPayload({ lane, payer: a(8), amount: 5n, deadline: 9n });
    expect(decode(payload)).toEqual([lane, hexToBigInt(a(8)), 5n, 9n]);
  });
});
