import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGuardedClients, type GuardedClients } from '@hackatwin/chains';
import { loadProfile } from '@hackatwin/config';
import { type AgentEvent, Ports } from '@hackatwin/core';
import {
  composeRoot,
  findLiveReferences,
  type HopProgress,
  laneIdOf,
  parseWorld,
  paymentPayload,
  runDemo2,
  setupTreasury,
  startDemo2Run,
  Tokens,
  treasuryChain,
  type World,
} from '@hackatwin/demo-02-l1-crosschain/module';
import { type Address, parseAbi, parseAbiItem } from 'viem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCAL_HUB, LOCAL_L1 } from '../../src/local/anvils.ts';
import { execForge, type ForgeRunner } from '../../src/local/forge.ts';
import { runGit } from '../../src/local/icm-services.ts';
import { relayOnce } from '../../src/local/relay.ts';
import { runRelayLoop } from '../../src/local/relay-loop.ts';
import { accountAt, repoRoot, unlocked } from '../../src/local/teleporter.ts';
import { type UpResult, up } from '../../src/local/up.ts';

const env = { LOCAL_HUB_RPC_URL: LOCAL_HUB.rpcUrl, LOCAL_L1_RPC_URL: LOCAL_L1.rpcUrl };
const hubStatus = parseAbiItem(
  'event StatusChanged(bytes32 indexed _id, bytes32 indexed _paymentId, uint8 _from, uint8 _to)',
);
const receiverStatus = parseAbiItem('event StatusChanged(bytes32 indexed _paymentId, uint8 _from, uint8 _to)');
const balanceAbi = parseAbi(['function balanceOf(address) view returns (uint256)']);
const creditAbi = parseAbi(['function creditOf(address) view returns (uint256)']);

const pids: number[] = [];
const scripts: string[] = [];
const output: string[] = [];
const run: ForgeRunner = async (command, args, options) => {
  scripts.push(args[1] ?? '');
  await execForge(command, args, options);
};
const say = (line: string) => output.push(line);
const json = (value: unknown) => JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));

let treeBefore: string;
let local: UpResult;
let world: World;
let hub: GuardedClients;
let l1: GuardedClients;
let unlisted: Address;
let amount: bigint;

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const balanceOf = (token: Address, owner: Address) =>
  l1.public.readContract({ address: token, abi: balanceAbi, functionName: 'balanceOf', args: [owner] });
const creditOf = (merchant: Address) =>
  l1.public.readContract({
    address: world.contracts.receiver,
    abi: creditAbi,
    functionName: 'creditOf',
    args: [merchant],
  });
const relay = () => relayOnce({ hub: LOCAL_HUB, l1: LOCAL_L1 }, local.ids);
const compose = (override: Partial<World> = {}, progress?: HopProgress) =>
  composeRoot({ llm: 'scripted', env, world: { ...world, ...override }, ...(progress && { progress }) });

// The relay runs beside the agent, as `pnpm demo2:local:up` does.
function startRelay(): () => Promise<void> {
  const abort = new AbortController();
  const loop = runRelayLoop({
    once: (cursor) => relayOnce({ hub: LOCAL_HUB, l1: LOCAL_L1 }, local.ids, cursor),
    intervalMs: 200,
    signal: abort.signal,
    log: say,
  });
  return async () => {
    abort.abort();
    await loop;
  };
}

async function payThrough(root: Awaited<ReturnType<typeof compose>>, payer: Address = world.roles.treasury) {
  const deadline = (await hub.public.getBlock()).timestamp + 3600n;
  return root.container.resolve(Ports.CrossChainMessenger).send({
    destinationChainId: world.chains.l1.chainId,
    recipient: world.contracts.broker,
    amount: root.profile.budget.perPayment,
    payload: paymentPayload({ lane: laneIdOf(world), payer: payer as never, amount, deadline }),
  });
}

async function collect(root: Awaited<ReturnType<typeof compose>>, id: string) {
  const hops = [];
  for await (const hop of root.container.resolve(Ports.CrossChainMessenger).track(id)) hops.push(hop);
  return hops;
}

const hopsOf = (events: AgentEvent[]) => events.flatMap((e) => (e.type === 'hop' ? [e.hop] : []));

beforeAll(async () => {
  treeBefore = await runGit(['-C', repoRoot, 'status', '--porcelain']);
  local = await up('demo-2-test', { run });
  pids.push(...local.pids);
  world = parseWorld(JSON.parse(readFileSync(join(local.dir, 'world.json'), 'utf8')));
  hub = await createGuardedClients({ chain: LOCAL_HUB, rpcUrl: LOCAL_HUB.rpcUrl });
  l1 = await createGuardedClients({ chain: LOCAL_L1, rpcUrl: LOCAL_L1.rpcUrl });
  unlisted = (await accountAt(hub, 7)).address;
  const profile = loadProfile('local-crosschain', env);
  amount = profile.budget.perPayment.units;
  const chain = treasuryChain(hub, unlocked(world.roles.treasury));
  for (const merchant of [world.roles.merchant, unlisted])
    await setupTreasury({ chain, world: { ...world, roles: { ...world.roles, merchant } }, profile, print: say });
}, 300_000);

afterAll(() => {
  for (const pid of pids) if (alive(pid)) process.kill(pid, 'SIGTERM');
});

describe('Real deploy scripts', () => {
  it('Both scripts ran and the messenger targets the deployed receiver', () => {
    expect(scripts).toEqual(['script/DeployFuji.s.sol:DeployFuji', 'script/DeployL1.s.sol:DeployL1']);
    expect(local.deployed.receiver).toBe(world.contracts.receiver);
    expect(local.deployed.messenger).toBe(world.contracts.messenger);
  });
});

describe('Happy path', () => {
  let events: AgentEvent[];
  let fromBlock: bigint;
  let before: { merchant: bigint; credit: bigint };

  beforeAll(async () => {
    fromBlock = (await hub.public.getBlockNumber()) + 1n;
    before = {
      merchant: await balanceOf(world.contracts.remote, world.roles.merchant),
      credit: await creditOf(world.roles.merchant),
    };
    const stop = startRelay();
    events = [];
    const agent = await startDemo2Run({
      llm: 'scripted',
      compose: (o) => composeRoot({ ...o, world, env }),
      tools: { pollMs: 200 },
    });
    for await (const event of agent.events) {
      events.push(event);
      say(json(event));
    }
    await stop();
  }, 120_000);

  it('Hub: Pending then Dispatched each appear once', async () => {
    const logs = await hub.public.getLogs({ address: world.contracts.hub, event: hubStatus, fromBlock });
    expect(logs.map((l) => `${l.args._from}->${l.args._to}`)).toEqual(['0->1', '1->3']);
  });

  it('Receiver: Received then Settled each appear once and the merchant is credited the amount', async () => {
    const logs = await l1.public.getLogs({ address: world.contracts.receiver, event: receiverStatus, fromBlock: 0n });
    expect(logs.map((l) => `${l.args._from}->${l.args._to}`)).toEqual(['0->1', '1->2']);
    expect((await creditOf(world.roles.merchant)) - before.credit).toBe(amount);
  });

  it('One event per hop: send, Pending, Dispatched, Received, Settled at indices 0 to 4', () => {
    const hops = hopsOf(events);
    expect(hops.map((h) => [h.index, h.status])).toEqual([
      [0, 'None'],
      [1, 'Pending'],
      [2, 'Dispatched'],
      [3, 'Received'],
      [4, 'Settled'],
    ]);
  });

  it('Full track: the scripted agent needs no key, names itself and marks every event simulated', () => {
    const started = events.find((e) => e.type === 'run.started');
    expect(started).toMatchObject({ type: 'run.started', llm: 'scripted' });
    expect(events.at(-1)).toMatchObject({ type: 'run.finished', reason: 'done' });
    expect(events.every((e) => e.simulated === 'local-crosschain')).toBe(true);
    expect(hopsOf(events).every((h) => h.explorerUrl === undefined)).toBe(true);
  });
});

describe('Rejected path', () => {
  const lines: string[] = [];
  let before: { fallback: bigint; merchant: bigint };

  beforeAll(async () => {
    before = {
      fallback: await balanceOf(world.contracts.remote, local.roles.fallback),
      merchant: await creditOf(unlisted),
    };
    const stop = startRelay();
    const code = await runDemo2(
      {
        llm: 'scripted',
        compose: (o) => composeRoot({ ...o, world: { ...world, roles: { ...world.roles, merchant: unlisted } }, env }),
        tools: { pollMs: 200 },
      },
      (line) => lines.push(line),
    );
    await stop();
    output.push(...lines, `exit ${code}`);
  }, 120_000);

  it('Not allowlisted: the receiver emits Rejected and no Settled', async () => {
    const logs = await l1.public.getLogs({ address: world.contracts.receiver, event: receiverStatus, fromBlock: 0n });
    expect(logs.slice(-2).map((l) => `${l.args._from}->${l.args._to}`)).toEqual(['0->1', '1->3']);
    expect(lines[0]).toBe('SIMULATED (local-crosschain)');
    expect(lines.filter((l) => l.startsWith('hop ')).map((l) => l.split(':')[0])).toEqual([
      'hop 0',
      'hop 1',
      'hop 2',
      'hop 3',
      'hop 4',
    ]);
    expect(lines.some((l) => l.startsWith('hop 4: icm Rejected'))).toBe(true);
  });

  it('Fallback balance: the full amount sits at the fallback recipient and the merchant got nothing', async () => {
    expect((await balanceOf(world.contracts.remote, local.roles.fallback)) - before.fallback).toBe(amount);
    expect(await creditOf(unlisted)).toBe(before.merchant);
  });
});

describe('Tracker', () => {
  it('Broker rejection: a mismatched payer gives hop 0 and a Rejected hop 4 with the reason, nothing between', async () => {
    const root = await compose();
    const id = await payThrough(root, world.roles.agent);
    const hops = await collect(root, id);
    expect(hops.map((h) => [h.index, h.status])).toEqual([
      [0, 'None'],
      [4, 'Rejected'],
    ]);
    expect((hops[1] as { reason?: string }).reason).toMatch(/^0x[0-9a-f]{8}$/);
    await root.container.dispose();
  });

  it('Resume: a restarted tracker with the stored progress emits only the remaining hops', async () => {
    const store = new Map<string, number>();
    const progress: HopProgress = {
      last: (id) => store.get(id) ?? -1,
      record: (id, index) => store.set(id, Math.max(index, store.get(id) ?? -1)),
    };
    const first = await compose({}, progress);
    const id = await payThrough(first);
    expect((await collect(first, id)).map((h) => h.index)).toEqual([0, 1, 2]);
    await first.container.dispose();
    const restarted = await compose({}, progress);
    expect(await collect(restarted, id)).toEqual([]);
    expect((await relay()).failed).toEqual([]);
    expect((await collect(restarted, id)).map((h) => [h.index, h.status])).toEqual([
      [3, 'Received'],
      [4, 'Settled'],
    ]);
    await restarted.container.dispose();
  });
});

describe('ICTT funding', () => {
  it('The recipient L1 balance rises by the amount after the relay, at the required gas limit and fee 0', async () => {
    const root = await compose();
    const before = await balanceOf(world.contracts.remote, world.roles.agent);
    await root.container.resolve(Tokens.Funding).fund(world.roles.agent, amount);
    expect((await relay()).failed).toEqual([]);
    expect((await balanceOf(world.contracts.remote, world.roles.agent)) - before).toBe(amount);
    await root.container.dispose();
  });
});

describe('Labeling and cleanliness', () => {
  it('Scan in suite: no live reference in the captured output and events', () => {
    expect(output.length).toBeGreaterThan(10);
    expect(findLiveReferences(output.join('\n'))).toEqual([]);
  });

  it('Teardown: no anvil started by the run remains', async () => {
    for (const pid of pids) process.kill(pid, 'SIGTERM');
    for (let wait = 0; wait < 50 && pids.some(alive); wait++) await new Promise((r) => setTimeout(r, 100));
    expect(pids.filter(alive)).toEqual([]);
    for (const chain of [LOCAL_HUB, LOCAL_L1]) await expect(fetch(chain.rpcUrl, { method: 'POST' })).rejects.toThrow();
  });

  it('Clean tree: the run left git status as it found it', async () => {
    expect(await runGit(['-C', repoRoot, 'status', '--porcelain'])).toBe(treeBefore);
  });
});
