import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGuardedClients, type GuardedClients, type LocalChain, localChain } from '@hackatwin/chains';
import { txUrl } from '@hackatwin/chains/registry';
import { type Env, loadProfile, type Profile } from '@hackatwin/config';
import { type Container, createContainer, Ports } from '@hackatwin/core';
import type { Account } from 'viem';
import { ClientLogReader, type LogSource } from './adapters/log-reader.ts';
import { LocalCcipSender } from './adapters/sender.ts';
import { HopTracker, type TrackedChain } from './adapters/tracker.ts';
import { parseWorld, type World } from './deployment.ts';
import { registerCrossChainModule } from './module.ts';
import { Tokens } from './tokens.ts';

// The broker refuses a relay under 500000 gas, and the hub and dispatch calls run inside it.
const CCIP_GAS_LIMIT = 1_000_000;

export const WORLD_FILE = join(import.meta.dirname, '../../.cache/local-crosschain/dev/world.json');

export const readWorld = (file = WORLD_FILE): World => parseWorld(JSON.parse(readFileSync(file, 'utf8')));

export interface Root {
  readonly container: Container;
  readonly profile: Profile<'local-crosschain'>;
}

export interface RootOptions {
  // The LLM the process will use: `claude` needs ANTHROPIC_API_KEY, `scripted` needs nothing.
  readonly llm?: 'claude' | 'scripted';
  readonly world?: World;
  readonly env?: Env;
  readonly connect?: (chain: LocalChain) => Promise<GuardedClients>;
}

const connectLocal = (chain: LocalChain): Promise<GuardedClients> =>
  createGuardedClients({ chain, rpcUrl: chain.rpcUrl });

const logSource = ({ public: client }: GuardedClients): LogSource => ({
  getLogs: (args) => client.getLogs(args) as ReturnType<LogSource['getLogs']>,
});

// Every Demo 2 process starts here: profile, world manifest, guarded local clients, then the module.
export async function composeRoot({
  llm,
  world = readWorld(),
  env,
  connect = connectLocal,
}: RootOptions = {}): Promise<Root> {
  const profile = loadProfile('local-crosschain', env, llm === undefined ? {} : { llm });
  if (world.chains.hub.chainId !== profile.hubChainId || world.chains.l1.chainId !== profile.l1ChainId)
    throw new Error('world.json chain IDs differ from the local-crosschain profile');
  const hub = await connect(
    localChain('local-hub', { chainId: profile.hubChainId, rpcUrl: profile.env.LOCAL_HUB_RPC_URL }),
  );
  const l1 = await connect(
    localChain('local-l1', { chainId: profile.l1ChainId, rpcUrl: profile.env.LOCAL_L1_RPC_URL }),
  );
  for (const clients of [hub, l1])
    if (clients.refusal !== undefined) throw new Error(`refusing to start: ${clients.refusal}`);

  const container = createContainer();
  container.register(Tokens.World, () => world);
  container.register(Tokens.Hub, () => hub);
  registerCrossChainModule(container);
  container.register(Ports.CrossChainMessenger, (resolver) => {
    const { contracts, roles } = world;
    const local = (key: string, chainId: number): TrackedChain => ({ key, chainId, local: true });
    const [hubChain, l1Chain] = [local('local-hub', profile.hubChainId), local('local-l1', profile.l1ChainId)];
    const tracker = new HopTracker({
      reader: new ClientLogReader({ [hubChain.chainId]: logSource(hub), [l1Chain.chainId]: logSource(l1) }),
      source: { chain: hubChain, router: contracts.router },
      hub: { chain: hubChain, broker: contracts.broker, hub: contracts.hub },
      l1: { chain: l1Chain, receiver: contracts.receiver, remote: contracts.remote },
      explorerUrl: txUrl,
    });
    const agent = { address: roles.agent, type: 'json-rpc' } as Account;
    return new LocalCcipSender({
      client: hub.chainClient(agent),
      router: resolver.resolve(Tokens.Router),
      lanes: resolver.resolve(Tokens.Lanes),
      gasLimit: CCIP_GAS_LIMIT,
      tracker,
    });
  });
  return { container, profile };
}
