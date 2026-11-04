import type { Address, ChainClient } from '@hackatwin/core';
import type { Account, Transport } from 'viem';
import { createGuardedClients } from './guarded-clients.ts';

export interface ChainClientOptions {
  readonly chain: string;
  readonly rpcUrl: string;
  readonly account?: Account;
  readonly transport?: Transport;
}

export interface ChainsClient extends ChainClient {
  codeSize(address: Address, blockNumber?: bigint): Promise<number>;
}

export async function createChainClient({
  chain,
  rpcUrl,
  account,
  transport,
}: ChainClientOptions): Promise<ChainsClient> {
  const clients = await createGuardedClients({ chain, rpcUrl, ...(transport && { transport }) });
  return clients.chainClient(account);
}
