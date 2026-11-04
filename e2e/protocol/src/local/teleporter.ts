import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GuardedClients } from '@hackatwin/chains';
import { type Account, type Address, type Hex, isAddressEqual } from 'viem';
import { ICM_COMMIT, icmCacheDir } from './icm-fetch.ts';

export const CANONICAL_TELEPORTER: Address = '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf';
const V1_DEPLOYER: Address = '0x618FEdD9A45a8C456812ecAAE70C671c6249DfaC';
export const repoRoot = join(import.meta.dirname, '../../../..');

export const artifact = (path: string): { bytecode: Hex; deployedBytecode: Hex } => {
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    bytecode: { object: Hex };
    deployedBytecode: { object: Hex };
  };
  return { bytecode: json.bytecode.object, deployedBytecode: json.deployedBytecode.object };
};

export const icmArtifact = (name: string) =>
  artifact(join(icmCacheDir(repoRoot, ICM_COMMIT), `out/${name}.sol/${name}.json`));

type Rpc = { request(args: { method: 'eth_accounts' }): Promise<Address[]> };
export const unlocked = (address: Address): Account => ({ address, type: 'json-rpc' }) as Account;
export const accountAt = async (c: GuardedClients, index: number): Promise<Account> => {
  const address = (await (c.public as unknown as Rpc).request({ method: 'eth_accounts' }))[index];
  if (!address) throw new Error(`anvil exposes no unlocked account ${index}`);
  return unlocked(address);
};
export const firstAccount = (c: GuardedClients): Promise<Account> => accountAt(c, 0);

// The v1 deployer is impersonated at nonce 0 and deploys the pinned build, so CREATE yields the canonical address.
export async function placeTeleporter(c: GuardedClients): Promise<Address> {
  const cheats = c.cheats();
  await cheats.setBalance(V1_DEPLOYER, 10n ** 18n);
  await cheats.impersonate(V1_DEPLOYER);
  const data = icmArtifact('TeleporterMessenger').bytecode;
  const hash = await c.wallet(unlocked(V1_DEPLOYER)).sendTransaction({ data, gas: 6_000_000n });
  await cheats.stopImpersonating(V1_DEPLOYER);
  const receipt = await c.public.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress || !isAddressEqual(receipt.contractAddress, CANONICAL_TELEPORTER))
    throw new Error(`Teleporter deployed at ${receipt.contractAddress}`);
  return CANONICAL_TELEPORTER;
}
