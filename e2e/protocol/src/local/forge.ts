import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LocalChain } from '@hackatwin/chains';
import type { Address, Hex } from 'viem';

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
