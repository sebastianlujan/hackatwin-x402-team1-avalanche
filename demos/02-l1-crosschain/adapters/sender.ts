import type { Address, ChainClient, CrossChainMessenger, Hex, Hop, Transfer } from '@hackatwin/core';
import { type Abi, decodeEventLog, pad, parseAbi, zeroAddress } from 'viem';
import { extraArgsV3 } from './extra-args.ts';

const ROUTER_ABI = parseAbi([
  'struct EVMTokenAmount { address token; uint256 amount; }',
  'struct EVM2AnyMessage { bytes receiver; bytes data; EVMTokenAmount[] tokenAmounts; address feeToken; bytes extraArgs; }',
  'function isChainSupported(uint64 destChainSelector) view returns (bool)',
  'function getFee(uint64 destinationChainSelector, EVM2AnyMessage message) view returns (uint256)',
  'function ccipSend(uint64 destinationChainSelector, EVM2AnyMessage message) payable returns (bytes32)',
  'event MessageExecuted(bytes32 messageId, uint64 sourceChainSelector, address offRamp, bytes32 calldataHash)',
]);
const DEFAULT_GAS_LIMIT = 200_000;

// Destination chain ID to CCIP chain selector.
export type Lanes = Readonly<Record<number, bigint>>;

export interface LocalCcipSenderOptions {
  readonly client: ChainClient;
  readonly router: Address;
  readonly lanes: Lanes;
  readonly gasLimit?: number;
}

export class LocalCcipSender implements CrossChainMessenger {
  readonly transport = 'local';
  private readonly client: ChainClient;
  private readonly router: Address;
  private readonly lanes: Lanes;
  private readonly gasLimit: number;

  constructor({ client, router, lanes, gasLimit = DEFAULT_GAS_LIMIT }: LocalCcipSenderOptions) {
    this.client = client;
    this.router = router;
    this.lanes = lanes;
    this.gasLimit = gasLimit;
  }

  // Data-only message: the amount travels inside the payload, never as a CCIP token.
  async send(transfer: Transfer): Promise<string> {
    const selector = this.lanes[transfer.destinationChainId];
    if (selector === undefined) throw new Error(`no CCIP lane for chain ID ${transfer.destinationChainId}`);
    const message = {
      receiver: pad(transfer.recipient),
      data: transfer.payload ?? '0x',
      tokenAmounts: [],
      feeToken: zeroAddress,
      extraArgs: extraArgsV3(this.gasLimit),
    };
    const { router } = this;
    const abi = ROUTER_ABI as Abi;
    const supported = await this.client.read<boolean>({
      address: router,
      abi,
      functionName: 'isChainSupported',
      args: [selector],
    });
    if (!supported.value) throw new Error(`CCIP lane ${selector} is not supported by the router`);
    const fee = await this.client.read<bigint>({
      address: router,
      abi,
      functionName: 'getFee',
      args: [selector, message],
    });
    const hash = await this.client.write({
      address: router,
      abi,
      functionName: 'ccipSend',
      args: [selector, message],
      value: fee.value,
    });
    return this.messageId(await this.client.waitForReceipt(hash));
  }

  track(_messageId: string): AsyncIterable<Hop> {
    throw new Error('tracking is not part of the sender');
  }

  private messageId({ status, logs }: Awaited<ReturnType<ChainClient['waitForReceipt']>>): Hex {
    if (status !== 'success') throw new Error('ccipSend reverted');
    for (const log of logs) {
      if (log.address.toLowerCase() !== this.router.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi: ROUTER_ABI, topics: log.topics as [Hex, ...Hex[]], data: log.data });
        if (event.eventName === 'MessageExecuted') return event.args.messageId;
      } catch {
        // Not a router event we decode.
      }
    }
    throw new Error('ccipSend receipt has no MessageExecuted event');
  }
}
