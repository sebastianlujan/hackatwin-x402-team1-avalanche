import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGuardedClients, type LocalChain } from '@hackatwin/chains';
import { type Address, isAddressEqual, parseAbi } from 'viem';
import { type ForgeRunner, runForgeScript } from './forge.ts';
import { firstAccount, repoRoot } from './teleporter.ts';
import type { WorldContracts } from './world.ts';

export const TREASURY_USDC = 100_000_000n;

export interface Deployed {
  hub: Address;
  broker: Address;
  messenger: Address;
  receiver: Address;
}

const messengerAbi = parseAbi(['function RECEIVER() view returns (address)']);
const mintAbi = parseAbi(['function mint(address to, uint256 amount)']);

const record = (forgeDir: string, name: string): Record<string, Address> =>
  JSON.parse(readFileSync(join(forgeDir, 'deployments', `${name}.json`), 'utf8'));

// Step 6: the real DeployFuji on the hub, then the real DeployL1 on the L1, each as its own unlocked deployer.
export async function deployScripts(
  hubChain: LocalChain,
  l1Chain: LocalChain,
  world: WorldContracts,
  run?: ForgeRunner,
): Promise<Deployed> {
  const base = { forgeDir: world.forgeDir, contractsDir: join(repoRoot, 'packages/contracts'), ...(run && { run }) };
  const { roles } = world;
  await runForgeScript({
    ...base,
    chain: hubChain,
    target: 'script/DeployFuji.s.sol:DeployFuji',
    sender: roles.deployer,
  });
  await runForgeScript({
    ...base,
    chain: l1Chain,
    target: 'script/DeployL1.s.sol:DeployL1',
    sender: roles.receiverDeployer,
  });
  const fuji = record(world.forgeDir, 'fuji');
  const receiver = record(world.forgeDir, 'twinpay-l1').receiver as Address;
  const hub = await createGuardedClients({ chain: hubChain, rpcUrl: hubChain.rpcUrl });
  const target = await hub.public.readContract({
    address: fuji.messenger as Address,
    abi: messengerAbi,
    functionName: 'RECEIVER',
  });
  if (!isAddressEqual(target, receiver)) throw new Error('the messenger does not target the deployed receiver');
  return { hub: fuji.hub as Address, broker: fuji.broker as Address, messenger: fuji.messenger as Address, receiver };
}

// Step 7: the treasury, which pays through the broker, starts with USDC on the hub.
export async function mintTreasury(hubChain: LocalChain, world: WorldContracts): Promise<void> {
  const hub = await createGuardedClients({ chain: hubChain, rpcUrl: hubChain.rpcUrl });
  const hash = await hub.wallet(await firstAccount(hub)).writeContract({
    address: world.usdc,
    abi: mintAbi,
    functionName: 'mint',
    args: [world.roles.treasury, TREASURY_USDC],
  });
  const receipt = await hub.public.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`treasury mint reverted in ${hash}`);
}
