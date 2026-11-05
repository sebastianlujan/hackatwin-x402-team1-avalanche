import type { Address, Hex } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import { createIcttFunding, REQUIRED_GAS_LIMIT } from '../../adapters/ictt-funding.ts';

const a = (n: number) => `0x${n.toString(16).repeat(40)}` as Address;
const [TOKEN, HOME, REMOTE, OWNER, ALICE, BOB] = [a(1), a(2), a(3), a(4), a(5), a(6)];
const L1_ID = `0x${'2'.repeat(64)}` as Hex;
const ZERO = '0x0000000000000000000000000000000000000000';

class RevertingClient extends FakeChainClient {
  override async waitForReceipt(txHash: Hex) {
    return { ...(await super.waitForReceipt(txHash)), status: 'reverted' as const };
  }
}

const allowance = (value: bigint) => ({ [readKey(TOKEN, 'allowance', [OWNER, HOME])]: value });
const funding = (client: FakeChainClient) =>
  createIcttFunding({ client, token: TOKEN, home: HOME, remote: REMOTE, destination: L1_ID, owner: OWNER });
const input = (recipient: Address) => ({
  destinationBlockchainID: L1_ID,
  destinationTokenTransferrerAddress: REMOTE,
  recipient,
  primaryFeeTokenAddress: ZERO,
  primaryFee: 0n,
  secondaryFee: 0n,
  requiredGasLimit: REQUIRED_GAS_LIMIT,
  multiHopFallback: ZERO,
});

describe('createIcttFunding', () => {
  it('approves the home, then sends the amount to the recipient through the remote', async () => {
    const client = new FakeChainClient({ reads: allowance(0n) });
    const hash = await funding(client).fund(ALICE, 3_000_000n);
    expect(client.writes.map((w) => [w.address, w.functionName])).toEqual([
      [TOKEN, 'approve'],
      [HOME, 'send'],
    ]);
    expect(client.writes[0]?.args).toEqual([HOME, 3_000_000n]);
    expect(client.writes[1]?.args).toEqual([input(ALICE), 3_000_000n]);
    expect(hash).toBe(`0x${'2'.padStart(64, '0')}`);
  });

  it('skips the approval when the allowance already covers the amount', async () => {
    const client = new FakeChainClient({ reads: allowance(9_000_000n) });
    await funding(client).fund(BOB, 7_000_000n);
    expect(client.writes.map((w) => w.functionName)).toEqual(['send']);
    expect(client.writes[0]?.args).toEqual([input(BOB), 7_000_000n]);
  });

  it('names the failed step when a transaction reverts', async () => {
    const client = new RevertingClient({ reads: allowance(0n) });
    await expect(funding(client).fund(ALICE, 1n)).rejects.toThrow('approve reverted');
    expect(client.writes).toHaveLength(1);
  });
});
