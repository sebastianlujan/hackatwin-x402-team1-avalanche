import { type Address, type Hex, money } from '@hackatwin/core';
import { encodeAbiParameters, encodeErrorResult, keccak256, parseAbi } from 'viem';
import { describe, expect, it } from 'vitest';
import { parseWorld } from '../deployment.ts';
import { BANNER } from '../labels.ts';
import { setupTreasury, type TreasuryChain, type TypedData } from './setup.ts';

const a = (n: number) => `0x${n.toString(16).repeat(40)}` as Address;
const USDC = a(1);
const HUB = a(2);
const BROKER = a(3);
const MESSENGER = a(4);
const TREASURY = a(7);
const MERCHANT = a(9);
const L1_ID = `0x${'2'.repeat(64)}` as Hex;
const NOW = 1_700_000_000n;
const TOTAL = 5_000_000n;

const world = parseWorld({
  version: 1,
  instance: 'dev',
  chains: {
    hub: { key: 'local-hub', chainId: 31337, rpcUrl: 'http://127.0.0.1:18545', blockchainId: `0x${'1'.repeat(64)}` },
    l1: { key: 'local-l1', chainId: 31338, rpcUrl: 'http://127.0.0.1:18546', blockchainId: L1_ID },
  },
  contracts: {
    usdc: USDC,
    hub: HUB,
    broker: BROKER,
    messenger: MESSENGER,
    receiver: a(5),
    router: a(6),
    home: a(10),
    remote: a(11),
    selector: '99',
  },
  roles: { treasury: TREASURY, agent: a(8), merchant: MERCHANT },
});

const hubAbi = parseAbi([
  'error PaymentHub_LaneNotFound(bytes32 id)',
  'error PaymentHub_Unauthorized(address caller)',
  'error PaymentHub_BudgetExceeded(uint256 remaining, uint256 amount)',
]);
const laneId = (token: Address, merchant: Address, messenger: Address, destination: Hex): Hex =>
  keccak256(
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'bytes32' }],
        },
      ],
      [[token, merchant, messenger, destination]],
    ),
  );
const EXPECTED_LANE = laneId(USDC, MERCHANT, MESSENGER, L1_ID);

// A chain that behaves like the hub and the token for the calls the setup makes.
class FakeHubChain implements TreasuryChain {
  readonly writes: { functionName: string; args: readonly unknown[] }[] = [];
  readonly signed: TypedData[] = [];
  readonly lanes = new Set<Hex>();
  allowance = 0n;
  budget = 0n;
  touched = 0;

  async read<T>(call: { functionName: string }): Promise<T> {
    this.touched += 1;
    if (call.functionName === 'allowance') return this.allowance as T;
    if (call.functionName === 'nonces') return 0n as T;
    throw new Error(`unscripted read ${call.functionName}`);
  }
  async write(call: { functionName: string; args?: readonly unknown[] }): Promise<Hex> {
    this.touched += 1;
    const args = call.args ?? [];
    this.writes.push({ functionName: call.functionName, args });
    if (call.functionName === 'createLane') {
      const p = args[0] as { token: Address; merchant: Address; messenger: Address; destination: Hex };
      this.lanes.add(laneId(p.token, p.merchant, p.messenger, p.destination));
    }
    if (call.functionName === 'approve') this.allowance = args[1] as bigint;
    if (call.functionName === 'setAuthorizationWithSig') this.budget = (args[0] as { budget: bigint }).budget;
    return `0x${this.writes.length.toString(16).padStart(64, '0')}`;
  }
  async revertData(call: { args?: readonly unknown[] }, from: Address): Promise<Hex> {
    this.touched += 1;
    const [id, , amount] = call.args as [Hex, Address, bigint];
    if (!this.lanes.has(id))
      return encodeErrorResult({ abi: hubAbi, errorName: 'PaymentHub_LaneNotFound', args: [id] });
    if (this.budget === 0n)
      return encodeErrorResult({ abi: hubAbi, errorName: 'PaymentHub_Unauthorized', args: [from] });
    return encodeErrorResult({ abi: hubAbi, errorName: 'PaymentHub_BudgetExceeded', args: [this.budget, amount] });
  }
  async signTypedData(typed: TypedData): Promise<Hex> {
    this.touched += 1;
    this.signed.push(typed);
    return `0x${'ab'.repeat(65)}`;
  }
  async blockTimestamp(): Promise<bigint> {
    this.touched += 1;
    return NOW;
  }
  names = () => this.writes.map((w) => w.functionName);
}

const run = async (chain: TreasuryChain, profile: Parameters<typeof setupTreasury>[0]['profile']) => {
  const lines: string[] = [];
  const result = await setupTreasury({ chain, world, profile, print: (line) => lines.push(line) });
  return { lines, result };
};
const profileOf = (units: bigint) => ({ budget: { total: money(units, 6, 'USD') } });

describe('Treasury setup', () => {
  it('First run: creates the lane, approves the hub and signs the budget for the broker', async () => {
    const chain = new FakeHubChain();
    const { result } = await run(chain, profileOf(TOTAL));

    expect(chain.names()).toEqual(['createLane', 'approve', 'setAuthorizationWithSig']);
    expect(chain.writes[0]?.args).toEqual([
      { token: USDC, merchant: MERCHANT, messenger: MESSENGER, destination: L1_ID },
    ]);
    expect(chain.writes[1]?.args).toEqual([HUB, TOTAL]);
    const typed = chain.signed[0];
    expect(typed?.domain).toEqual({ name: 'PaymentHub', version: '1', chainId: 31337, verifyingContract: HUB });
    expect(typed?.message).toEqual({
      authorizer: TREASURY,
      authorized: BROKER,
      token: USDC,
      budget: TOTAL,
      nonce: 0n,
      deadline: NOW + 3600n,
    });
    expect(result.laneId).toBe(EXPECTED_LANE);
    expect(chain.lanes.has(EXPECTED_LANE)).toBe(true);
  });

  it('Second run: sends no transaction and keeps the lane Id', async () => {
    const chain = new FakeHubChain();
    const first = await run(chain, profileOf(TOTAL));
    const sent = chain.writes.length;
    const second = await run(chain, profileOf(TOTAL));

    expect(sent).toBe(3);
    expect(chain.writes).toHaveLength(sent);
    expect(chain.signed).toHaveLength(1);
    expect(second.result.laneId).toBe(first.result.laneId);
    expect(second.result.remaining).toBe(TOTAL);
  });

  it('Second run: leaves a partly spent budget alone', async () => {
    const chain = new FakeHubChain();
    chain.lanes.add(EXPECTED_LANE);
    chain.allowance = TOTAL;
    chain.budget = 3_000_000n;
    const { result, lines } = await run(chain, profileOf(TOTAL));

    expect(chain.writes).toHaveLength(0);
    expect(chain.signed).toHaveLength(0);
    expect(result.remaining).toBe(3_000_000n);
    expect(lines).toContain('remaining budget: 3.000000 USDC');
  });

  it('Profile budget: signs and approves the amount of the profile', async () => {
    const chain = new FakeHubChain();
    await run(chain, profileOf(2_500_000n));

    expect(chain.signed[0]?.message.budget).toBe(2_500_000n);
    expect(chain.writes[1]?.args).toEqual([HUB, 2_500_000n]);
  });

  it.each([[{}], [{ budget: {} }]])('Missing budget: %j fails naming budget.total before any call', async (profile) => {
    const chain = new FakeHubChain();

    await expect(run(chain, profile)).rejects.toThrow(/budget\.total/);
    expect(chain.touched).toBe(0);
  });

  it('Output: line 1 is the banner, then the lane Id and the remaining budget', async () => {
    const chain = new FakeHubChain();
    const { lines } = await run(chain, profileOf(TOTAL));

    expect(lines[0]).toBe('SIMULATED (local-crosschain)');
    expect(BANNER).toBe(lines[0]);
    expect(lines).toContain(`lane: ${EXPECTED_LANE}`);
    expect(lines).toContain('remaining budget: 5.000000 USDC');
  });
});
