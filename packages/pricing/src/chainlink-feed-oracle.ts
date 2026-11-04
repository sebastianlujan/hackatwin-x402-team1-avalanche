import type { Address, ChainClient } from '@hackatwin/core';
import { PricingError } from './pricing-error.ts';
import type { RateReading, RateSource } from './rate-reading.ts';

export interface ChainlinkFeedAddresses {
  readonly feed: Address;
  readonly sequencer: Address;
  readonly heartbeatSeconds: number;
}

type Round = readonly [bigint, bigint, bigint, bigint, bigint];

const GRACE_SECONDS = 3600n;
const output = (name: string, type: string) => ({ name, type });
const ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [output('', 'uint8')] },
  {
    type: 'function',
    name: 'latestRoundData',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      output('roundId', 'uint80'),
      output('answer', 'int256'),
      output('startedAt', 'uint256'),
      output('updatedAt', 'uint256'),
      output('answeredInRound', 'uint80'),
    ],
  },
];

export class ChainlinkFeedOracle implements RateSource {
  private readonly client: ChainClient;
  private readonly addresses: ChainlinkFeedAddresses;
  private readonly now: () => number;

  // now returns epoch milliseconds
  constructor(client: ChainClient, addresses: ChainlinkFeedAddresses, now: () => number = Date.now) {
    this.client = client;
    this.addresses = addresses;
    this.now = now;
  }

  async reading(): Promise<RateReading> {
    const { feed, sequencer, heartbeatSeconds } = this.addresses;
    const blockNumber = await this.client.blockNumber();
    const read = <T>(address: Address, functionName: string) =>
      this.client.read<T>({ address, abi: ABI, functionName, args: [] }, { blockNumber });
    const [decimals, round, up] = await Promise.all([
      read<number | bigint>(feed, 'decimals'),
      read<Round>(feed, 'latestRoundData'),
      read<Round>(sequencer, 'latestRoundData'),
    ]);
    const now = BigInt(Math.floor(this.now() / 1000));

    const [, status, startedAt] = up.value;
    if (status !== 0n) throw new PricingError('chainlink sequencer is down');
    if (startedAt === 0n) throw new PricingError('chainlink sequencer round is unreadable (startedAt is 0)');
    if (now - startedAt < GRACE_SECONDS) {
      throw new PricingError(
        `chainlink sequencer is in its grace period: up ${now - startedAt} s of ${GRACE_SECONDS} s`,
      );
    }

    const [, answer, , updatedAt] = round.value;
    if (answer <= 0n) throw new PricingError(`chainlink answer must be positive, got ${answer}`);
    if (updatedAt === 0n || now - updatedAt > BigInt(heartbeatSeconds)) {
      throw new PricingError(`chainlink round is stale: updated ${updatedAt} s, heartbeat ${heartbeatSeconds} s`);
    }

    const argtPerUsd = 10n ** (BigInt(decimals.value) + 18n) / answer;
    return { source: 'chainlink', argtPerUsd, chainId: this.client.chainId, blockNumber };
  }
}
