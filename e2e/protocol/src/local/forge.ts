import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { assertLocalChain, type LocalChain } from '@hackatwin/chains';
import { childEnv } from '@hackatwin/config';
import { type Address, type Hex, isAddress } from 'viem';
import { probeAnvil } from './anvils.ts';

export interface Roles {
  deployer: Address;
  receiverDeployer: Address;
  treasury: Address;
  agent: Address;
  merchant: Address;
  fallback: Address;
}

export interface ForgeFacts {
  chains: { hub: LocalChain; l1: LocalChain };
  ids: { hub: Hex; l1: Hex };
  usdc: Address;
  router: Address;
  selector: bigint;
  home: Address;
  remote: Address;
  roles: Roles;
}

// The instance name is one path segment, so the directory cannot leave the cache.
export function forgeDir(projectRoot: string, instance: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(instance)) throw new Error('instance must be letters, digits and dashes');
  return join(projectRoot, '.cache', 'local-crosschain', instance, 'forge');
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const entry = (address: Address) => ({ address });

// The hub is registered as fuji and the L1 as twinpay-l1 because the scripts hardcode those keys.
export async function writeForgeFiles(dir: string, f: ForgeFacts): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  for (const sub of ['registry', 'params', 'deployments']) await mkdir(join(dir, sub), { recursive: true });
  const files: Record<string, unknown> = {
    'registry/fuji.json': {
      key: 'fuji',
      chainId: f.chains.hub.chainId,
      contracts: { usdc: entry(f.usdc), ccipRouter: entry(f.router) },
      icm: { usdcTokenHome: f.home, blockchainId: f.ids.hub },
    },
    'registry/twinpay-l1.json': {
      key: 'twinpay-l1',
      chainId: f.chains.l1.chainId,
      icm: { usdcTokenRemote: f.remote, blockchainId: f.ids.l1 },
      contracts: {},
    },
    'registry/local-ccip.json': { key: 'local-ccip', ccip: { chainSelector: f.selector.toString() } },
    'params/fuji.json': {
      deployer: f.roles.deployer,
      owner: f.roles.deployer,
      fallbackRecipient: f.roles.fallback,
      requiredGasLimit: 500000,
      recipientGasLimit: 300000,
      receiverDeployer: f.roles.receiverDeployer,
      receiverDeployerNonce: 0,
      brokerPairs: [{ chain: 'local-ccip', sender: f.roles.agent, payer: f.roles.treasury }],
    },
    'params/twinpay-l1.json': {
      deployer: f.roles.receiverDeployer,
      owner: f.roles.receiverDeployer,
      receiverDeployerNonce: 0,
      merchants: [f.roles.merchant],
    },
  };
  for (const [name, value] of Object.entries(files)) await writeFile(join(dir, name), json(value));
  await writeFile(join(dir, 'deployments/.gitkeep'), '');
}

export type ForgeRunner = (
  command: 'forge',
  args: string[],
  options: { cwd: string; env: Record<string, string> },
) => Promise<void>;

const exec = promisify(execFile);

// No shell, a fixed argument array and a fixed environment; only the stderr tail is surfaced.
export const execForge: ForgeRunner = async (command, args, options) => {
  try {
    await exec(command, args, { ...options, shell: false, maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? '';
    throw new Error(`forge ${args[1]} failed: ${stderr.trim().split('\n').slice(-5).join('\n')}`);
  }
};

// The sender is an unlocked anvil account: the signing flags of a keystore or a raw key are never used.
export const forgeScriptArgs = (target: string, rpcUrl: string, sender: Address): string[] => [
  ...['script', target, '--rpc-url', rpcUrl, '--broadcast'],
  ...['--unlocked', '--sender', sender],
];

export interface ForgeScriptOptions {
  chain: LocalChain;
  target: string;
  sender: Address;
  forgeDir: string;
  contractsDir: string;
  run?: ForgeRunner;
  probe?: (chain: LocalChain) => Promise<void>;
}

// Runs a deploy script unlocked, only on a loopback anvil that passed the probe.
export async function runForgeScript(o: ForgeScriptOptions): Promise<void> {
  if (!isAddress(o.sender, { strict: false })) throw new Error('sender must be an address');
  assertLocalChain(o.chain);
  await (o.probe ?? probeAnvil)(o.chain);
  const env = childEnv({
    CHAIN_REGISTRY_DIR: join(o.forgeDir, 'registry'),
    DEPLOY_PARAMS_DIR: join(o.forgeDir, 'params'),
    DEPLOY_DEPLOYMENTS_DIR: join(o.forgeDir, 'deployments'),
  });
  await (o.run ?? execForge)('forge', forgeScriptArgs(o.target, o.chain.rpcUrl, o.sender), {
    cwd: o.contractsDir,
    env,
  });
}
