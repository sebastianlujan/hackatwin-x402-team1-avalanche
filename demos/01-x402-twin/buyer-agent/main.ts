import { ClaudeLLM, createAgent, createEventChannel, Erc8004Identity, ScriptedPlanLLM } from '@hackatwin/agent-kit';
import { chain, type LiveChain } from '@hackatwin/chains';
import { type LLM, Ports } from '@hackatwin/core';
import { readIdentities } from '../adapters/registration.ts';
import { PORTS } from '../ports.ts';
import { composeRoot } from '../root.ts';
import { Tokens } from '../tokens.ts';
import { formatBalances, formatDeltas, formatEvent } from './format.ts';
import { preflight } from './preflight.ts';
import { PROMPT, SYSTEM } from './prompt.ts';
import { buyerPlan } from './scripted-plan.ts';

const up = async (url: string, expected: number): Promise<boolean> => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).status === expected;
  } catch {
    return false;
  }
};

async function main(): Promise<number> {
  const scripted = process.argv.includes('--scripted');
  const channel = createEventChannel();
  const { container, profile, fork } = await composeRoot({
    readChains: true,
    llm: scripted ? 'scripted' : 'claude',
    events: channel.emit,
  });
  const state = container.resolve(Tokens.State);
  const balances = container.resolve(Tokens.Balances);
  const cchain = chain('cchain') as LiveChain;
  const registry = new Erc8004Identity({
    chain: fork.chainClient(),
    identity: (cchain.contracts.erc8004Identity as { address: `0x${string}` }).address,
    reputation: (cchain.contracts.erc8004Reputation as { address: `0x${string}` }).address,
    signer: '0x0000000000000000000000000000000000000000',
  });
  const accounts = container.resolve(Tokens.Accounts);
  await preflight({
    refusal: fork.refusal,
    expectedBlock: profile.forkBlock,
    forkBlock: () => fork.cheats().forkBlock(),
    syncClock: () => fork.cheats().syncClock(BigInt(Math.floor(Date.now() / 1000))),
    registered: async () => {
      const ids = readIdentities(state);
      if (ids.agent === undefined || ids.seller === undefined) return false;
      const owners = await Promise.all([registry.ownerOf(ids.agent), registry.ownerOf(ids.seller)]);
      const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
      return same(owners[0], accounts.agent.address) && same(owners[1], accounts.seller.address);
    },
    funded: async () => state.read('funding.json') !== undefined && (await balances.read()).agent > 0n,
    serviceUp: (service) =>
      service === 'facilitator'
        ? up(`http://127.0.0.1:${PORTS.facilitator}/supported`, 200)
        : up(`http://127.0.0.1:${PORTS.seller}/quote`, 402),
  });

  const buyer = container.resolve(Tokens.Buyer);
  const llm: LLM = scripted
    ? new ScriptedPlanLLM(buyerPlan)
    : new ClaudeLLM({
        apiKey: profile.env.ANTHROPIC_API_KEY,
        ...(profile.llm?.provider === 'claude' && { model: profile.llm.model }),
      });
  const before = await balances.read();
  for (const line of formatBalances('before', before)) console.log(line);
  let reason = 'error';
  for await (const event of createAgent({
    llm,
    llmName: scripted ? 'scripted' : 'claude',
    tools: buyer.tools,
    policy: container.resolve(Ports.AgentPolicy),
    channel,
    system: SYSTEM,
    prompt: PROMPT,
    agent: 'buyer',
    profile: profile.name,
  })) {
    console.log(formatEvent(event));
    if (event.type === 'run.finished') reason = event.reason;
  }
  const after = await balances.read();
  for (const line of [...formatBalances('after', after), ...formatDeltas(before, after)]) console.log(line);
  return reason === 'done' ? 0 : 1;
}

process.exitCode = await main().catch((error: unknown) => {
  console.error(`demo1 failed: ${error instanceof Error ? error.message : String(error)}`);
  return 1;
});
