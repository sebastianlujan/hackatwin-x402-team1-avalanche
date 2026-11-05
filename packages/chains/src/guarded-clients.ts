import type { Address, ContractCall, Hex, ReadOptions, ReadResult, Receipt } from '@hackatwin/core';
import {
  type Abi,
  type Account,
  type Chain,
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  type LocalAccount,
  type PublicActions,
  type PublicClient,
  publicActions,
  type Transport,
  type WalletClient,
} from 'viem';
import type { ChainsClient } from './chain-client.ts';
import { ChainError } from './chain-error.ts';
import { chain as lookup, toViemChain } from './registry.ts';
import { isLoopback, needsClientVersion, writeRefusal } from './write-guard.ts';

export interface AnvilCheats {
  impersonate(address: Address): Promise<void>;
  stopImpersonating(address: Address): Promise<void>;
  setBalance(address: Address, wei: bigint): Promise<void>;
  syncClock(nowSeconds: bigint): Promise<bigint>;
  forkBlock(): Promise<bigint | undefined>;
  snapshot(): Promise<Hex>;
  revert(id: Hex): Promise<void>;
}

export type GuardedWallet = WalletClient<Transport, Chain, Account> & PublicActions<Transport, Chain, Account>;

export interface GuardedClients {
  readonly chainId: number;
  readonly refusal: string | undefined;
  readonly public: PublicClient;
  wallet(account: Account): GuardedWallet;
  chainClient(account?: Account): ChainsClient;
  cheats(): AnvilCheats;
}

export interface GuardedClientsOptions {
  readonly chain: string;
  readonly rpcUrl: string;
  readonly transport?: Transport;
}

// Read methods that stay open when writes are refused; anything not listed is refused.
const READ_METHODS: ReadonlySet<string> = new Set(
  `eth_chainId net_version web3_clientVersion eth_blockNumber eth_call eth_estimateGas eth_feeHistory eth_gasPrice
  eth_maxPriorityFeePerGas eth_getBalance eth_getBlockByHash eth_getBlockByNumber eth_getCode eth_getLogs
  eth_getStorageAt eth_getTransactionByHash eth_getTransactionCount eth_getTransactionReceipt`.split(/\s+/),
);
const CHEAT_METHOD = /^(anvil|evm|hardhat)_/;
const CLOCK_SLACK_SECONDS = 30n;

export async function createGuardedClients({
  chain: key,
  rpcUrl,
  transport,
}: GuardedClientsOptions): Promise<GuardedClients> {
  const entry = lookup(key);
  const viemChain = toViemChain(key);
  if (entry.status !== 'live') throw new ChainError(`chain "${key}" is not deployed`);
  const via = transport ?? http(rpcUrl, { batch: true, retryCount: 3 });
  const probe = createPublicClient({ chain: viemChain, transport: via });
  const reported = await probe.getChainId();
  if (reported !== entry.chainId) {
    throw new ChainError(`chain "${key}" expects chain ID ${entry.chainId} but the RPC reports ${reported}`);
  }
  const clientVersion =
    needsClientVersion(entry.chainId, rpcUrl) || isLoopback(rpcUrl)
      ? await probe.request({ method: 'web3_clientVersion' })
      : undefined;
  const refusal = writeRefusal({
    chainId: entry.chainId,
    access: entry.access,
    rpcUrl,
    ...(clientVersion && { clientVersion }),
  });
  const onAnvil = isLoopback(rpcUrl) && /anvil/i.test(clientVersion ?? '');
  const cheatRefusal =
    refusal ?? (onAnvil ? undefined : 'anvil cheats need a loopback RPC that reports anvil, this RPC does not');

  const guarded: Transport = (params) => {
    const inner = via(params);
    return {
      ...inner,
      request: (async (args: { method: string }) => {
        if (CHEAT_METHOD.test(args.method) && cheatRefusal !== undefined) {
          throw new ChainError(`${args.method} refused: ${cheatRefusal}`);
        }
        if (refusal !== undefined && !READ_METHODS.has(args.method) && !CHEAT_METHOD.test(args.method)) {
          throw new ChainError(`${args.method} refused: ${refusal}`);
        }
        return inner.request(args as never);
      }) as typeof inner.request,
    };
  };

  const publicClient = createPublicClient({ chain: viemChain, transport: guarded });
  const refuseSigning = async (): Promise<never> => {
    throw new ChainError(`signing refused: ${refusal}`);
  };
  const guardAccount = (account: Account): Account =>
    refusal === undefined || account.type !== 'local'
      ? account
      : ({
          ...account,
          sign: refuseSigning,
          signAuthorization: refuseSigning,
          signMessage: refuseSigning,
          signTransaction: refuseSigning,
          signTypedData: refuseSigning,
        } as LocalAccount);
  const wallet = (account: Account): GuardedWallet =>
    createWalletClient({ account: guardAccount(account), chain: viemChain, transport: guarded }).extend(
      publicActions,
    ) as GuardedWallet;

  return {
    chainId: entry.chainId,
    refusal,
    public: publicClient as PublicClient,
    wallet,
    chainClient(account?: Account): ChainsClient {
      const signer = account === undefined ? undefined : wallet(account);
      return {
        chainId: entry.chainId,
        blockNumber: () => publicClient.getBlockNumber(),
        async codeSize(target: Address, blockNumber?: bigint): Promise<number> {
          const code = await publicClient.getCode({
            address: target,
            ...(blockNumber !== undefined && { blockNumber }),
          });
          return code === undefined ? 0 : (code.length - 2) / 2;
        },
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
          if (signer === undefined) throw new ChainError(`write refused: client for "${key}" has no account`);
          return signer.writeContract({
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
    },
    cheats(): AnvilCheats {
      if (cheatRefusal !== undefined) throw new ChainError(`anvil cheats refused: ${cheatRefusal}`);
      const test = createTestClient({ mode: 'anvil', chain: viemChain, transport: guarded });
      return {
        impersonate: (address) => test.impersonateAccount({ address }),
        stopImpersonating: (address) => test.stopImpersonatingAccount({ address }),
        setBalance: (address, wei) => test.setBalance({ address, value: wei }),
        async syncClock(nowSeconds) {
          const head = (await publicClient.getBlock()).timestamp;
          if (nowSeconds - head <= CLOCK_SLACK_SECONDS) return head;
          await test.setNextBlockTimestamp({ timestamp: nowSeconds });
          await test.mine({ blocks: 1 });
          return (await publicClient.getBlock()).timestamp;
        },
        async forkBlock() {
          const info = (await test.request({ method: 'anvil_nodeInfo' } as never)) as {
            forkConfig?: { forkBlockNumber?: number | string };
          };
          const block = info.forkConfig?.forkBlockNumber;
          return block === undefined ? undefined : BigInt(block);
        },
        snapshot: () => test.snapshot(),
        revert: (id) => test.revert({ id }),
      };
    },
  };
}
