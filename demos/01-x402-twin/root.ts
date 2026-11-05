import { createChainClient, createGuardedClients, type GuardedClients } from '@hackatwin/chains';
import { loadKeystoreAccount } from '@hackatwin/chains/keystore';
import { ConfigError, loadProfile, type Profile } from '@hackatwin/config';
import { type AgentEvent, type Container, createContainer } from '@hackatwin/core';
import { registerX402Module, type X402ModuleConfig } from './module.ts';
import { fileState, ROLES, type Role } from './state.ts';
import { Tokens } from './tokens.ts';

export interface Root {
  readonly container: Container;
  readonly profile: Profile<'cchain-fork'>;
  readonly fork: GuardedClients;
}

// Every Demo 1 process starts here: profile, keystores, guarded fork client, then the module.
export interface RootOptions {
  readonly readChains?: boolean;
  // The LLM the process will use: `claude` needs ANTHROPIC_API_KEY, checked before any chain call.
  readonly llm?: 'claude' | 'scripted';
  readonly events?: (event: AgentEvent) => void;
  // Where keystores live when KEYSTORE_DIR is unset; only CLI entries pass it.
  readonly stateDir?: string;
  readonly urls?: X402ModuleConfig;
}

export async function composeRoot({
  readChains = false,
  llm,
  events,
  stateDir,
  urls,
}: RootOptions = {}): Promise<Root> {
  const profile = loadProfile('cchain-fork', undefined, llm === undefined ? {} : { llm });
  const { env } = profile;
  const dir = env.KEYSTORE_DIR ?? stateDir;
  if (dir === undefined) throw new ConfigError([{ variable: 'KEYSTORE_DIR', message: 'is required' }]);
  const accounts = Object.fromEntries(
    ROLES.map((role: Role) => {
      const upper = role.toUpperCase() as 'AGENT' | 'SELLER' | 'FACILITATOR';
      return [role, loadKeystoreAccount(env[`${upper}_KEYSTORE`], env[`${upper}_KEYSTORE_PASSWORD_FILE`], dir)];
    }),
  ) as Record<Role, ReturnType<typeof loadKeystoreAccount>>;
  const fork = await createGuardedClients({ chain: 'cchain', rpcUrl: env.CCHAIN_FORK_RPC_URL });
  if (fork.refusal !== undefined) throw new Error(`refusing to start: ${fork.refusal}`);
  const reads = readChains
    ? {
        arbitrum: await createChainClient({ chain: 'arbitrum', rpcUrl: env.ARBITRUM_RPC_URL }),
        base: await createChainClient({ chain: 'base', rpcUrl: env.BASE_RPC_URL }),
      }
    : undefined;
  const container = createContainer();
  container.register(Tokens.Config, () => profile);
  container.register(Tokens.Accounts, () => accounts);
  container.register(Tokens.Fork, () => fork);
  if (reads !== undefined) container.register(Tokens.ReadChains, () => reads);
  container.register(Tokens.State, () => fileState(dir));
  if (events !== undefined) container.register(Tokens.Events, () => events);
  registerX402Module(container, urls);
  return { container, profile, fork };
}
