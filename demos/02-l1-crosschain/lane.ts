import type { Hex } from '@hackatwin/core';
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import type { World } from './deployment.ts';

const LANE_PARAMS = parseAbiParameters('(address token, address merchant, address messenger, bytes32 destination)');
const PAYLOAD_PARAMS = parseAbiParameters('bytes32 lane, uint256 payer, uint256 amount, uint256 deadline');

// The one lane the demo pays through: USDC to the merchant over the ICTT messenger toward the L1.
export const laneParams = ({ contracts, roles, chains }: World) => ({
  token: contracts.usdc,
  merchant: roles.merchant,
  messenger: contracts.messenger,
  destination: chains.l1.blockchainId,
});

export const laneIdOf = (world: World): Hex => keccak256(encodeAbiParameters(LANE_PARAMS, [laneParams(world)]));

export interface PaymentPayload {
  readonly lane: Hex;
  readonly payer: Hex;
  readonly amount: bigint;
  readonly deadline: bigint;
}

// The broker's 128-byte payload: lane, payer on whose behalf it pays, amount, deadline.
export const paymentPayload = ({ lane, payer, amount, deadline }: PaymentPayload): Hex =>
  encodeAbiParameters(PAYLOAD_PARAMS, [lane, BigInt(payer), amount, deadline]);
