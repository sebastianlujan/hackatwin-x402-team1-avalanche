import type { ChainClient, ContractCall, Hex, ReadOptions, ReadResult, Receipt } from '@hackatwin/core';
import { type Abi, type Account, createPublicClient, createWalletClient, http, type Transport } from 'viem';
import { ChainError } from './chain-error.ts';
import { chain as lookup, toViemChain } from './registry.ts';
import { needsClientVersion, writeRefusal } from './write-guard.ts';

export interface ChainClientOptions {
  readonly chain: string;
  readonly rpcUrl: string;
  readonly account?: Account;
  readonly transport?: Transport;
}

export async function createChainClient({
  chain: key,
  rpcUrl,
  account,
  transport,
}: ChainClientOptions): Promise<ChainClient> {
  const entry = lookup(key);
  const viemChain = toViemChain(key);
  if (entry.status !== 'live') throw new ChainError(`chain "${key}" is not deployed`);
  const via = transport ?? http(rpcUrl, { batch: true, retryCount: 3 });
  const publicClient = createPublicClient({ chain: viemChain, transport: via });
  const reported = await publicClient.getChainId();
  if (reported !== entry.chainId) {
    throw new ChainError(`chain "${key}" expects chain ID ${entry.chainId} but the RPC reports ${reported}`);
  }
  const clientVersion = needsClientVersion(entry.chainId, rpcUrl)
    ? await publicClient.request({ method: 'web3_clientVersion' })
    : undefined;
  const refusal = writeRefusal({
    chainId: entry.chainId,
    access: entry.access,
    rpcUrl,
    ...(clientVersion && { clientVersion }),
  });
  const wallet = account === undefined ? undefined : createWalletClient({ account, chain: viemChain, transport: via });

  return {
    chainId: entry.chainId,
    blockNumber: () => publicClient.getBlockNumber(),
    async read<T>(call: ContractCall, options: ReadOptions = {}): Promise<ReadResult<T>> {
      const blockNumber = options.blockNumber ?? (await publicClient.getBlockNumber());
      const value = await publicClient.readContract({
        address: call.address,
        abi: call.abi as Abi,
        functionName: call.functionName,
        args: call.args as readonly unknown[],
        blockNumber,
      });
      return { value: value as T, blockNumber };
    },
    async write(call: ContractCall): Promise<Hex> {
      if (refusal !== undefined) throw new ChainError(`write refused: ${refusal}`);
      if (wallet === undefined) throw new ChainError(`write refused: client for "${key}" has no account`);
      return wallet.writeContract({
        address: call.address,
        abi: call.abi as Abi,
        functionName: call.functionName,
        args: call.args as readonly unknown[],
      });
    },
    async waitForReceipt(txHash: Hex): Promise<Receipt> {
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const logs = receipt.logs.map(({ address, topics, data }) => ({ address, topics, data }));
      return { txHash, status: receipt.status, blockNumber: receipt.blockNumber, logs };
    },
  };
}
