import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chain, createGuardedClients, type GuardedClients, type LiveChain } from '@hackatwin/chains';
import { loadKeystoreAccount } from '@hackatwin/chains/keystore';
import { CCHAIN_FORK_BLOCK } from '@hackatwin/config';
import { money } from '@hackatwin/core';
import { FakePriceOracle } from '@hackatwin/core/testing';
import { x402Client } from '@x402/core/client';
import type { PaymentRequirements } from '@x402/core/types';
import { toClientEvmSigner } from '@x402/evm';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startFork } from '../scripts/fork.ts';
import { fileState } from '../state.ts';
import { createFacilitatorApp } from './facilitator-app.ts';
import { createFundingChain, fund } from './funding.ts';
import { createX402Facilitator, NETWORK } from './x402-facilitator.ts';

const PORT = 8546;
const dir = join(mkdtempSync(join(tmpdir(), 'facilitator-live-')), '.demo1');
const cchain = chain('cchain') as LiveChain;
const address = (name: string) => (cchain.contracts[name] as { address: `0x${string}` }).address;
const balanceOf = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
const account = (role: string) => loadKeystoreAccount(role, join(dir, `${role}.password`), dir);

let pid: number | undefined;
let fork: GuardedClients;
let snapshot: `0x${string}`;
const [agent, seller, facilitator] = [() => account('agent'), () => account('seller'), () => account('facilitator')];

const arguments_ = (maxTimeoutSeconds: number): PaymentRequirements => ({
  scheme: 'exact',
  network: NETWORK,
  asset: address('argt'),
  amount: String(10n ** 18n),
  payTo: seller().address,
  maxTimeoutSeconds,
  extra: { assetTransferMethod: 'permit2' },
});

const signPayment = async (requirements: PaymentRequirements) => {
  const client = new x402Client().setSpendControls(false);
  registerExactEvmScheme(client, { signer: toClientEvmSigner(agent(), fork.public) });
  return client.createPaymentPayload({
    x402Version: 2,
    resource: { url: 'http://127.0.0.1:4021/quote', description: 'fx quote', mimeType: 'application/json' },
    accepts: [requirements],
  });
};

const call = async (path: '/verify' | '/settle', paymentPayload: unknown, paymentRequirements: unknown) =>
  createFacilitatorApp(createX402Facilitator(fork, facilitator())).request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
  });

const argtOf = async (who: `0x${string}`) =>
  (
    await fork
      .chainClient()
      .read<bigint>({ address: address('argt'), abi: balanceOf, functionName: 'balanceOf', args: [who] })
  ).value;

beforeAll(async () => {
  const started = await startFork({ dir, port: PORT });
  pid = started.pid;
  fork = await createGuardedClients({ chain: 'cchain', rpcUrl: started.url });
  const adapter = address('twinAdapter');
  await fund({
    chain: createFundingChain({ fork, token: address('argt'), permit2: address('permit2'), adapter, agent: agent() }),
    oracle: new FakePriceOracle(money(603n, 6, 'USD'), Date.now),
    state: fileState(dir),
    budgetTotal: money(5_000_000n, 6, 'USD'),
    forkBlock: CCHAIN_FORK_BLOCK,
    agent: agent().address,
    gasFor: [agent().address, seller().address, facilitator().address, adapter],
  });
});

beforeEach(async () => {
  snapshot = await fork.cheats().snapshot();
  await fork.cheats().syncClock(BigInt(Math.floor(Date.now() / 1000)));
});

afterAll(async () => {
  if (pid === undefined) return;
  process.kill(pid, 'SIGINT');
  for (let i = 0; i < 100; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
});

describe('live facilitator', () => {
  it('verifies and settles a Permit2 payment and the payee balance rises by the amount', async () => {
    const requirements = arguments_(30);
    const payload = await signPayment(requirements);
    const before = await argtOf(seller().address);
    const verify = await call('/verify', payload, requirements);
    expect(await verify.json()).toMatchObject({ isValid: true });
    const settle = await call('/settle', payload, requirements);
    const settled = (await settle.json()) as { success: boolean; transaction: string };
    expect(settled.success).toBe(true);
    expect(settled.transaction).toMatch(/^0x[0-9a-f]{64}$/);
    expect((await argtOf(seller().address)) - before).toBe(10n ** 18n);
    console.log(`settled tx ${settled.transaction} payee ${before} -> ${await argtOf(seller().address)}`);
    await fork.cheats().revert(snapshot);
  });

  it('marks a payment past its deadline invalid and settles nothing', async () => {
    const requirements = arguments_(1);
    const payload = await signPayment(requirements);
    await fork.public.request({ method: 'evm_increaseTime', params: ['0x3c'] } as never);
    await fork.public.request({ method: 'evm_mine', params: [] } as never);
    const before = await argtOf(seller().address);
    const verify = (await (await call('/verify', payload, requirements)).json()) as { isValid: boolean };
    expect(verify.isValid).toBe(false);
    const settle = (await (await call('/settle', payload, requirements)).json()) as { success: boolean };
    expect(settle.success).toBe(false);
    expect(await argtOf(seller().address)).toBe(before);
    await fork.cheats().revert(snapshot);
  });
});
