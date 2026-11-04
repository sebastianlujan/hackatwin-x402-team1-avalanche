import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventChannel, Erc8004Identity, type EventChannel, ScriptedPlanLLM } from '@hackatwin/agent-kit';
import { chain, createGuardedClients, type GuardedClients, type LiveChain, startAnvil } from '@hackatwin/chains';
import { CCHAIN_FORK_BLOCK, loadProfile, loadRpcUrls, type Profile } from '@hackatwin/config';
import { type Address, type AgentEvent, createContainer, type Money, money, Ports } from '@hackatwin/core';
import { FakePriceOracle } from '@hackatwin/core/testing';
import { buyerPlan, registerX402Module, runBuyer, serveLoopback, Tokens } from '@hackatwin/demo-01-x402-twin/module';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export const PORT = 8546;

// ARGt per USD as the USD price of one ARGt, at 18 decimals.
export const argtPerUsd = (hundredths: bigint): Money => money((10n ** 18n * 100n) / hundredths, 18, 'USD');
export const RATE = argtPerUsd(165_836n);

export interface ForkNode {
  readonly fork: GuardedClients;
  stop(): Promise<void>;
}

// Anvil on the pinned block; the clock is synced so Permit2 validity windows hold.
export async function startForkNode(): Promise<ForkNode> {
  const upstream = loadRpcUrls({ cchain: (chain('cchain') as LiveChain).rpc?.public }).cchain as string;
  const logFile = join(mkdtempSync(join(tmpdir(), 'demo-1-e2e-')), 'anvil.log');
  const { pid, url } = await startAnvil({ upstream, forkBlock: CCHAIN_FORK_BLOCK, port: PORT, logFile });
  const fork = await createGuardedClients({ chain: 'cchain', rpcUrl: url });
  await fork.cheats().syncClock(BigInt(Math.floor(Date.now() / 1000)));
  return {
    fork,
    async stop() {
      process.kill(pid, 'SIGINT');
      for (let i = 0; i < 100; i++) {
        try {
          process.kill(pid, 0);
        } catch {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },
  };
}

export interface World {
  readonly ids: { readonly agent: bigint; readonly seller: bigint };
  readonly addresses: { readonly agent: Address; readonly seller: Address };
  balances(): Promise<{ readonly agent: bigint; readonly seller: bigint }>;
  reputation(agentId: bigint): Promise<{ readonly count: bigint }>;
  run(): Promise<AgentEvent[]>;
  close(): Promise<void>;
}

const dummyEnv = (url: string) => ({
  KEYSTORE_DIR: '/unused',
  CCHAIN_FORK_RPC_URL: url,
  CCHAIN_RPC_URL: url,
  ARBITRUM_RPC_URL: url,
  BASE_RPC_URL: url,
  ...Object.fromEntries(
    ['AGENT', 'SELLER', 'FACILITATOR'].flatMap((role) => [
      [`${role}_KEYSTORE`, role.toLowerCase()],
      [`${role}_KEYSTORE_PASSWORD_FILE`, `/unused/${role.toLowerCase()}.password`],
    ]),
  ),
});

// Fresh in-memory keys, the real module, and fixed-rate oracles swapped in through child containers.
export async function createWorld(
  fork: GuardedClients,
  { sellerRate = RATE }: { sellerRate?: Money } = {},
): Promise<World> {
  const accounts = {
    agent: privateKeyToAccount(generatePrivateKey()),
    seller: privateKeyToAccount(generatePrivateKey()),
    facilitator: privateKeyToAccount(generatePrivateKey()),
  };
  const memory = new Map<string, unknown>();
  const channel: EventChannel = createEventChannel();
  const root = createContainer();
  root.register(
    Tokens.Config,
    () => loadProfile('cchain-fork', dummyEnv('http://127.0.0.1:8546'), { llm: 'scripted' }) as Profile<'cchain-fork'>,
  );
  root.register(Tokens.Accounts, () => accounts);
  root.register(Tokens.Fork, () => fork);
  root.register(Tokens.State, () => ({
    dir: '/memory',
    read: <T>(name: string) => memory.get(name) as T | undefined,
    write: (name: string, value: unknown) => void memory.set(name, JSON.parse(JSON.stringify(value))),
  }));
  let facilitatorUrl = '';
  let sellerUrl = '';
  registerX402Module(root, { facilitatorUrl: () => facilitatorUrl, sellerUrl: () => sellerUrl });
  const buyerSide = root.child();
  buyerSide.register(Ports.PriceOracle, () => new FakePriceOracle(RATE, Date.now));
  buyerSide.register(Tokens.Events, () => channel.emit);
  const sellerSide = root.child();
  sellerSide.register(Ports.PriceOracle, () => new FakePriceOracle(sellerRate, Date.now));

  await buyerSide.resolve(Tokens.Funding).fund();
  const { ids } = await root.resolve(Tokens.Registration).register();
  const facilitator = await serveLoopback(root.resolve(Tokens.FacilitatorApp), 0);
  facilitatorUrl = facilitator.url;
  const seller = await serveLoopback(sellerSide.resolve(Tokens.SellerApp), 0);
  sellerUrl = seller.url;

  const cchain = chain('cchain') as LiveChain;
  const registry = new Erc8004Identity({
    chain: fork.chainClient(),
    identity: (cchain.contracts.erc8004Identity as { address: Address }).address,
    reputation: (cchain.contracts.erc8004Reputation as { address: Address }).address,
    signer: accounts.agent.address,
  });
  return {
    ids,
    addresses: { agent: accounts.agent.address, seller: accounts.seller.address },
    balances: () => buyerSide.resolve(Tokens.Balances).read(),
    reputation: (agentId) => registry.reputation(agentId),
    async run() {
      const events: AgentEvent[] = [];
      const llm = new ScriptedPlanLLM(buyerPlan);
      for await (const event of runBuyer({ container: buyerSide, channel, llm, llmName: 'scripted' }))
        events.push(event);
      return events;
    },
    async close() {
      await Promise.all([facilitator.close(), seller.close()]);
    },
  };
}
