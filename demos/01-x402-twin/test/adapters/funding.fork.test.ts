import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chain, createGuardedClients, type GuardedClients, type LiveChain } from '@hackatwin/chains';
import { loadKeystoreAccount } from '@hackatwin/chains/keystore';
import { CCHAIN_FORK_BLOCK } from '@hackatwin/config';
import { money } from '@hackatwin/core';
import { FakePriceOracle } from '@hackatwin/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFundingChain, fund, MIN_GAS_WEI } from '../../adapters/funding.ts';
import { startFork } from '../../scripts/fork.ts';
import { fileState } from '../../state.ts';

const PORT = 8546;
const dir = join(mkdtempSync(join(tmpdir(), 'fund-live-')), '.demo1');
const cchain = chain('cchain') as LiveChain;
const address = (name: string) => (cchain.contracts[name] as { address: `0x${string}` }).address;
const transferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;
let pid: number | undefined;
let fork: GuardedClients;

const account = (role: string) => loadKeystoreAccount(role, join(dir, `${role}.password`), dir);
const options = () => {
  const [agent, seller, facilitator] = [account('agent'), account('seller'), account('facilitator')];
  const adapter = address('twinAdapter');
  return {
    agent,
    seller,
    run: () =>
      fund({
        chain: createFundingChain({ fork, token: address('argt'), permit2: address('permit2'), adapter, agent }),
        oracle: new FakePriceOracle(money(603n, 6, 'USD'), Date.now),
        state: fileState(dir),
        budgetTotal: money(5_000_000n, 6, 'USD'),
        forkBlock: CCHAIN_FORK_BLOCK,
        agent: agent.address,
        gasFor: [agent.address, seller.address, facilitator.address, adapter],
      }),
    gasOf: (who: `0x${string}`) => fork.public.getBalance({ address: who }),
    adapter,
    facilitator,
  };
};

beforeAll(async () => {
  const started = await startFork({ dir, port: PORT });
  pid = started.pid;
  fork = await createGuardedClients({ chain: 'cchain', rpcUrl: started.url });
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

describe('live funding', () => {
  it('funds the four roles, tops up on a rerun and sends nothing when already funded', async () => {
    const setup = options();
    const first = await setup.run();
    expect(first.gasToppedUp).toHaveLength(4);
    expect(first).toMatchObject({ minted: first.target, approved: true });
    for (const who of [setup.agent.address, setup.seller.address, setup.facilitator.address, setup.adapter]) {
      expect(await setup.gasOf(who)).toBeGreaterThanOrEqual(MIN_GAS_WEI);
    }
    expect(await options().run()).toMatchObject({ minted: 0n, approved: false, gasToppedUp: [] });
  });

  it('mints exactly the amount paid and reuses the recorded target', async () => {
    const setup = options();
    const recorded = await setup.run();
    const paid = 10n ** 18n;
    const agent = fork.chainClient(setup.agent);
    const hash = await agent.write({
      address: address('argt'),
      abi: transferAbi,
      functionName: 'transfer',
      args: [setup.seller.address, paid],
    });
    await agent.waitForReceipt(hash);
    expect(await setup.run()).toMatchObject({ target: recorded.target, minted: paid, approved: false });
  });
});
