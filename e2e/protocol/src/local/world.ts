import { join } from 'node:path';
import { createGuardedClients, type GuardedClients, type LocalChain } from '@hackatwin/chains';
import { type Address, type Hex, keccak256, parseAbi, toHex } from 'viem';
import { artifact, CANONICAL_TELEPORTER, firstAccount, icmArtifact, placeTeleporter, repoRoot } from './teleporter.ts';

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
