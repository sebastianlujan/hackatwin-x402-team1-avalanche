import {
  ClaudeLLM,
  createEventChannel,
  Erc8004Identity,
  type EventChannel,
  ScriptedPlanLLM,
} from '@hackatwin/agent-kit';
import { chain, type LiveChain } from '@hackatwin/chains';
import type { AgentEvent, LLM } from '@hackatwin/core';
import type { BalanceSnapshot } from '../adapters/balances.ts';
import { readIdentities } from '../adapters/registration.ts';
import type { X402ModuleConfig } from '../module.ts';
import { PORTS } from '../ports.ts';
import { composeRoot, type Root, type RootOptions } from '../root.ts';
import { Tokens } from '../tokens.ts';
import { type PreflightDeps, preflight } from './preflight.ts';
import { runBuyer } from './run.ts';
import { buyerPlan } from './scripted-plan.ts';

export interface Demo1RunOptions {
  readonly llm: 'claude' | 'scripted';
  readonly stateDir?: string;
  readonly urls?: X402ModuleConfig;
  readonly channel?: EventChannel;
  readonly preflight?: Partial<PreflightDeps>;
  readonly compose?: (options: RootOptions) => Promise<Root>;
}

export interface Demo1Run {
  readonly llm: 'claude' | 'scripted';
  readonly before: BalanceSnapshot;
  readonly events: AsyncIterable<AgentEvent>;
  after(): Promise<BalanceSnapshot>;
}

const up = async (url: string, expected: number): Promise<boolean> => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).status === expected;
  } catch {
    return false;
  }
};

const cchainContract = (name: 'erc8004Identity' | 'erc8004Reputation'): `0x${string}` =>
  ((chain('cchain') as LiveChain).contracts[name] as { address: `0x${string}` }).address;

function liveDeps({ container, profile, fork }: Root): PreflightDeps {
  const [state, balances, accounts] = [
    container.resolve(Tokens.State),
    container.resolve(Tokens.Balances),
    container.resolve(Tokens.Accounts),
  ];
  const registry = new Erc8004Identity({
    chain: fork.chainClient(),
    identity: cchainContract('erc8004Identity'),
    reputation: cchainContract('erc8004Reputation'),
    signer: '0x0000000000000000000000000000000000000000',
  });
  const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
  return {
    refusal: fork.refusal,
    expectedBlock: profile.forkBlock,
    forkBlock: () => fork.cheats().forkBlock(),
    syncClock: () => fork.cheats().syncClock(BigInt(Math.floor(Date.now() / 1000))),
    registered: async () => {
      const ids = readIdentities(state);
      if (ids.agent === undefined || ids.seller === undefined) return false;
      const owners = await Promise.all([registry.ownerOf(ids.agent), registry.ownerOf(ids.seller)]);
      return same(owners[0], accounts.agent.address) && same(owners[1], accounts.seller.address);
    },
    funded: async () => state.read('funding.json') !== undefined && (await balances.read()).agent > 0n,
    serviceUp: (service) =>
      service === 'facilitator'
        ? up(`http://127.0.0.1:${PORTS.facilitator}/supported`, 200)
        : up(`http://127.0.0.1:${PORTS.seller}/quote`, 402),
  };
}

// One Demo 1 buyer run: compose, preflight, balances before; the events end after run.finished.
export async function startDemo1Run(options: Demo1RunOptions): Promise<Demo1Run> {
  const { llm, stateDir, urls, channel = createEventChannel(), compose = composeRoot } = options;
  const root = await compose({
    readChains: true,
    llm,
    ...(stateDir === undefined ? {} : { stateDir }),
    ...(urls === undefined ? {} : { urls }),
  });
  // The run's events, policy and buyer live in a child scope, disposed with the run.
  const scope = root.container.child();
  scope.register(Tokens.Events, () => channel.emit);
  const dispose = async (): Promise<void> => {
    await scope.dispose();
    await root.container.dispose();
  };
  try {
    await preflight({ ...liveDeps(root), ...options.preflight });
    const balances = scope.resolve(Tokens.Balances);
    const model: LLM =
      llm === 'scripted'
        ? new ScriptedPlanLLM(buyerPlan)
        : new ClaudeLLM({
            apiKey: root.profile.env.ANTHROPIC_API_KEY,
            ...(root.profile.llm?.provider === 'claude' && { model: root.profile.llm.model }),
          });
    const before = await balances.read();
    const run = runBuyer({ container: scope, channel, llm: model, llmName: llm });
    const events = (async function* () {
      try {
        yield* run;
      } finally {
        await dispose();
      }
    })();
    return { llm, before, events, after: () => balances.read() };
  } catch (error) {
    await dispose();
    throw error;
  }
}
