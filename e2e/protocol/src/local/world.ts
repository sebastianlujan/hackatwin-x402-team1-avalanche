import { join } from 'node:path';
import { createGuardedClients, type GuardedClients, type LocalChain } from '@hackatwin/chains';
import { type Abi, type Address, type Hex, keccak256, parseAbi, toHex, zeroAddress } from 'viem';
import { forgeDir, type Roles, writeForgeFiles } from './forge.ts';
import { relayOnce } from './relay.ts';
import {
  accountAt,
  artifact,
  CANONICAL_TELEPORTER,
  firstAccount,
  icmArtifact,
  placeTeleporter,
  repoRoot,
} from './teleporter.ts';

export const WARP: Address = '0x0200000000000000000000000000000000000005';

export interface Infra {
  ids: { hub: Hex; l1: Hex };
  registry: { hub: Address; l1: Address };
}

export const stubAbi = parseAbi([
  'function setBlockchainID(bytes32 id)',
  'function setVerifiedMessage(uint32 index, bytes32 sourceChainID, address originSender, bytes payload)',
  'event WarpMessageSent(bytes32 indexed messageID, bytes message)',
]);
const registryAbi = parseAbi(['constructor((uint256 version, address protocolAddress)[] initialEntries)']);

// The Teleporter registry constructor reads the blockchain ID from the Warp address, so the stub goes first.
async function placeStub(c: GuardedClients, id: Hex): Promise<void> {
  const stub = artifact(join(repoRoot, 'packages/contracts/out/WarpMessengerStub.sol/WarpMessengerStub.json'));
  await c.cheats().setCode(WARP, stub.deployedBytecode);
  const hash = await c
    .wallet(await firstAccount(c))
    .writeContract({ address: WARP, abi: stubAbi, functionName: 'setBlockchainID', args: [id] });
  await c.public.waitForTransactionReceipt({ hash });
}

async function deployRegistry(c: GuardedClients): Promise<Address> {
  const hash = await c.wallet(await firstAccount(c)).deployContract({
    abi: registryAbi,
    bytecode: icmArtifact('TeleporterRegistry').bytecode,
    args: [[{ version: 1n, protocolAddress: CANONICAL_TELEPORTER }]],
  });
  const { contractAddress } = await c.public.waitForTransactionReceipt({ hash });
  if (!contractAddress) throw new Error('TeleporterRegistry deploy returned no address');
  return contractAddress;
}

async function setupChain(chain: LocalChain, id: Hex): Promise<Address> {
  const c = await createGuardedClients({ chain, rpcUrl: chain.rpcUrl });
  await placeStub(c, id);
  await placeTeleporter(c);
  return deployRegistry(c);
}

export async function deployInfra(hub: LocalChain, l1: LocalChain): Promise<Infra> {
  const ids = { hub: keccak256(toHex('local-hub')), l1: keccak256(toHex('local-l1')) };
  return { ids, registry: { hub: await setupChain(hub, ids.hub), l1: await setupChain(l1, ids.l1) } };
}

export interface WorldContracts {
  usdc: Address;
  simulator: Address;
  router: Address;
  selector: bigint;
  home: Address;
  remote: Address;
  roles: Roles;
  forgeDir: string;
}

const homeAbi = parseAbi([
  'constructor(address teleporterRegistryAddress, address teleporterManager, uint256 minTeleporterVersion, address tokenAddress, uint8 tokenDecimals)',
]);
const remoteAbi = parseAbi([
  'constructor((address teleporterRegistryAddress, address teleporterManager, uint256 minTeleporterVersion, bytes32 tokenHomeBlockchainID, address tokenHomeAddress, uint8 tokenHomeDecimals) settings, string tokenName, string tokenSymbol, uint8 tokenDecimals)',
  'function registerWithHome((address feeTokenAddress, uint256 amount) feeInfo)',
]);
const simulatorAbi = parseAbi([
  'function configuration() view returns (uint64 chainSelector_, address sourceRouter_, address destinationRouter_, address wrappedNative_, address linkToken_, address ccipBnM_, address ccipLnM_)',
]);

const contractsOut = (name: string) => join(repoRoot, `packages/contracts/out/${name}.sol/${name}.json`);

async function create(c: GuardedClients, abi: Abi, bytecode: Hex, args: unknown[] = []): Promise<Address> {
  const hash = await c.wallet(await firstAccount(c)).deployContract({ abi, bytecode, args });
  const receipt = await c.public.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`deploy reverted in ${hash}`);
  return receipt.contractAddress;
}

async function rolesOf(c: GuardedClients): Promise<Roles> {
  const at = async (i: number) => (await accountAt(c, i)).address;
  return {
    deployer: await at(1),
    receiverDeployer: await at(2),
    treasury: await at(3),
    agent: await at(4),
    merchant: await at(5),
    fallback: await at(6),
  };
}

// Steps 4 and 5: the hub token, simulator and ICTT home, the L1 remote (registered by a relayed message), then the forge files.
export async function deployContracts(
  hubChain: LocalChain,
  l1Chain: LocalChain,
  infra: Infra,
  instance: string,
): Promise<WorldContracts> {
  const hub = await createGuardedClients({ chain: hubChain, rpcUrl: hubChain.rpcUrl });
  const l1 = await createGuardedClients({ chain: l1Chain, rpcUrl: l1Chain.rpcUrl });
  const manager = (await firstAccount(hub)).address;
  const usdc = await create(hub, [], artifact(contractsOut('LocalUsdc')).bytecode);
  const simulator = await create(hub, simulatorAbi, artifact(contractsOut('CCIPLocalSimulator')).bytecode);
  const [selector, router] = await hub.public.readContract({
    address: simulator,
    abi: simulatorAbi,
    functionName: 'configuration',
  });
  const home = await create(hub, homeAbi, icmArtifact('ERC20TokenHome').bytecode, [
    infra.registry.hub,
    manager,
    1n,
    usdc,
    6,
  ]);
  const settings = {
    teleporterRegistryAddress: infra.registry.l1,
    teleporterManager: manager,
    minTeleporterVersion: 1n,
    tokenHomeBlockchainID: infra.ids.hub,
    tokenHomeAddress: home,
    tokenHomeDecimals: 6,
  };
  const remote = await create(l1, remoteAbi, icmArtifact('ERC20TokenRemote').bytecode, [
    settings,
    'Local USDC',
    'USDC',
    6,
  ]);
  const register = await l1.wallet(await firstAccount(l1)).writeContract({
    address: remote,
    abi: remoteAbi,
    functionName: 'registerWithHome',
    args: [{ feeTokenAddress: zeroAddress, amount: 0n }],
  });
  const registered = await l1.public.waitForTransactionReceipt({ hash: register });
  if (registered.status !== 'success') throw new Error(`registerWithHome reverted in ${register}`);
  const report = await relayOnce({ hub: hubChain, l1: l1Chain }, infra.ids);
  if (report.failed.length > 0) throw new Error(`registerWithHome relay failed: ${report.failed[0]?.reason}`);

  const roles = await rolesOf(hub);
  const dir = forgeDir(repoRoot, instance);
  await writeForgeFiles(dir, {
    chains: { hub: hubChain, l1: l1Chain },
    ids: infra.ids,
    usdc,
    router,
    selector,
    home,
    remote,
    roles,
  });
  return { usdc, simulator, router, selector, home, remote, roles, forgeDir: dir };
}
