import { type Address, convertMoney, money } from '@hackatwin/core';
import { FakePriceOracle } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import type { DemoState } from '../state.ts';
import { type FundingChain, FundingError, fund, MIN_GAS_WEI, TOP_UP_GAS_WEI } from './funding.ts';

const [agent, seller, facilitator, adapter] = [1, 2, 3, 4].map((n) => `0x${String(n).repeat(40)}` as Address) as [
  Address,
  Address,
  Address,
  Address,
];
const gasFor = [agent, seller, facilitator, adapter];
const budgetTotal = money(5_000_000n, 6, 'USD');
// One ARGt costs 0.000603 USD; T is the ARGt amount for twice the budget.
const rate = money(603n, 6, 'USD');
const T = convertMoney(money(10_000_000n, 6, 'USD'), rate, { decimals: 18, currency: 'ARGt' }).units;

const memoryState = (): DemoState & { files: Map<string, unknown> } => {
  const files = new Map<string, unknown>();
  return {
    dir: '/mem',
    files,
    read: (name) => files.get(name) as never,
    write: (name, value) => void files.set(name, value),
  };
};

// A scripted chain: balances and allowance move only through the recorded calls.
function chain(start: { balance?: bigint; allowance?: bigint; gas?: bigint } = {}) {
  const calls: string[] = [];
  const gas = new Map<Address, bigint>();
  const state = { balance: start.balance ?? 0n, allowance: start.allowance ?? 0n, brokenApprove: false };
  const api: FundingChain = {
    gas: async (address) => gas.get(address) ?? start.gas ?? 0n,
    async setGas(address, wei) {
      gas.set(address, wei);
      calls.push(`setGas ${address} ${wei}`);
    },
    balance: async () => state.balance,
    allowance: async () => state.allowance,
    async mint(_to, amount) {
      state.balance += amount;
      calls.push(`mint ${amount}`);
    },
    async approve(amount) {
      state.allowance = state.brokenApprove ? amount - 1n : amount;
      calls.push(`approve ${amount}`);
    },
  };
  return { api, calls, state };
}

const run = (target: ReturnType<typeof chain>, state = memoryState(), forkBlock = 100n) => {
  const oracle = new FakePriceOracle(rate, () => 0);
  const quote = oracle.quote.bind(oracle);
  let quotes = 0;
  oracle.quote = (...args) => {
    quotes += 1;
    return quote(...args);
  };
  const options = { chain: target.api, oracle, state, budgetTotal, forkBlock, agent, gasFor };
  return { state, quotes: () => quotes, result: fund(options), again: () => fund(options) };
};

describe('fund', () => {
  it('tops up gas, mints the target, approves exactly the target and records it', async () => {
    const target = chain();
    const { result, state } = run(target);
    const report = await result;
    expect(report.minted).toBe(report.target);
    expect(report).toMatchObject({ approved: true, gasToppedUp: gasFor });
    expect(target.calls.filter((call) => call.startsWith('setGas'))).toHaveLength(4);
    expect(target.calls).toContain(`setGas ${adapter} ${TOP_UP_GAS_WEI}`);
    expect(target.calls).toContain(`approve ${report.target}`);
    expect(target.calls.some((call) => call.includes(String(2n ** 256n - 1n)))).toBe(false);
    expect(state.files.get('funding.json')).toEqual({ forkBlock: '100', target: String(report.target) });
    expect(report.target).toBe(T);
  });

  it('sends no transaction on a rerun when balance and allowance are met', async () => {
    const target = chain();
    const { result, again } = run(target);
    await result;
    target.calls.length = 0;
    expect(await again()).toMatchObject({ minted: 0n, approved: false, gasToppedUp: [] });
    expect(target.calls).toEqual([]);
  });

  it('mints exactly the payment, approves T again and reuses the recorded T', async () => {
    const target = chain();
    const { result, again, quotes } = run(target);
    const { target: first } = await result;
    const paid = 10n ** 18n;
    target.state.balance -= paid;
    target.state.allowance -= paid;
    target.calls.length = 0;
    expect(await again()).toMatchObject({ target: first, minted: paid, approved: true });
    expect(target.calls).toEqual([`mint ${paid}`, `approve ${first}`]);
    expect(quotes()).toBe(1);
  });

  it('tops up gas only for addresses under 1 AVAX', async () => {
    const target = chain({ balance: T, allowance: T });
    await target.api.setGas(agent, MIN_GAS_WEI);
    target.calls.length = 0;
    const { result } = run(target, memoryState());
    expect((await result).gasToppedUp).toEqual([seller, facilitator, adapter]);
  });

  it('names the allowance when it does not equal the target after approving', async () => {
    const target = chain();
    target.state.brokenApprove = true;
    await expect(run(target).result).rejects.toThrow(/allowance .* does not equal the target/);
    await expect(run(chain({ allowance: 2n ** 255n }), memoryState()).result).rejects.toThrow(FundingError);
  });

  it('names the balance when minting leaves it below the target', async () => {
    const target = chain();
    target.api.mint = async () => undefined;
    await expect(run(target).result).rejects.toThrow(/balance 0 is below the target/);
  });

  it('quotes again for another fork block', async () => {
    const state = memoryState();
    const first = run(chain(), state, 100n);
    await first.result;
    const second = run(chain(), state, 200n);
    await second.result;
    expect(second.quotes()).toBe(1);
    expect(state.files.get('funding.json')).toMatchObject({ forkBlock: '200' });
  });
});
