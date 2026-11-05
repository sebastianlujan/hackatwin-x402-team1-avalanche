import { createChainClient, createGuardedClients } from '@hackatwin/chains';
import { loadKeystoreAccount } from '@hackatwin/chains/keystore';
import { loadProfile } from '@hackatwin/config';
import { createContainer, formatMoney, money } from '@hackatwin/core';
import { registerX402Module } from '../module.ts';
import { fileState, ROLES, STATE_DIR } from '../state.ts';
import { Tokens } from '../tokens.ts';

async function main(): Promise<void> {
  const { env } = loadProfile('cchain-fork');
  const profile = loadProfile('cchain-fork');
  const dir = env.KEYSTORE_DIR ?? STATE_DIR;
  const accounts = Object.fromEntries(
    ROLES.map((role) => {
      const upper = role.toUpperCase() as 'AGENT' | 'SELLER' | 'FACILITATOR';
      return [role, loadKeystoreAccount(env[`${upper}_KEYSTORE`], env[`${upper}_KEYSTORE_PASSWORD_FILE`], dir)];
    }),
  ) as Record<(typeof ROLES)[number], ReturnType<typeof loadKeystoreAccount>>;
  const fork = await createGuardedClients({ chain: 'cchain', rpcUrl: env.CCHAIN_FORK_RPC_URL });
  if (fork.refusal !== undefined) throw new Error(`refusing to fund: ${fork.refusal}`);
  const readChains = {
    arbitrum: await createChainClient({ chain: 'arbitrum', rpcUrl: env.ARBITRUM_RPC_URL }),
    base: await createChainClient({ chain: 'base', rpcUrl: env.BASE_RPC_URL }),
  };
  const container = createContainer();
  container.register(Tokens.Config, () => profile);
  container.register(Tokens.Accounts, () => accounts);
  container.register(Tokens.Fork, () => fork);
  container.register(Tokens.ReadChains, () => readChains);
  container.register(Tokens.State, () => fileState(dir));
  registerX402Module(container);
  const report = await container.resolve(Tokens.Funding).fund();
  const argt = (units: bigint) => formatMoney(money(units, 18, 'ARGt'));
  console.log(`gas topped up for ${report.gasToppedUp.length} address(es)`);
  console.log(
    `minted ${argt(report.minted)}, ${report.approved ? `approved ${argt(report.target)}` : 'allowance already set'}`,
  );
  console.log(`target ${argt(report.target)}`);
}

await main().catch((error: unknown) => {
  console.error(`fund failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
