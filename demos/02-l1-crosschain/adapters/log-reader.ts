import type { Address, Hex } from '@hackatwin/core';
import type { LogReader, TrackedLog } from './tracker-decode.ts';

// The shape of a viem log; hash, block and index are null while the log is pending.
export interface RawLog {
  readonly address: Address;
  readonly topics: readonly Hex[];
  readonly data: Hex;
  readonly transactionHash: Hex | null;
  readonly blockNumber: bigint | null;
  readonly logIndex: number | null;
}

export interface LogSource {
  getLogs(args: {
    readonly address: Address[];
    readonly fromBlock: 'earliest';
    readonly toBlock: 'latest';
  }): Promise<readonly RawLog[]>;
}

export class ClientLogReader implements LogReader {
  private readonly sources: Readonly<Record<number, LogSource>>;

  constructor(sources: Readonly<Record<number, LogSource>>) {
    this.sources = sources;
  }

  async logs(chainId: number, addresses: readonly Address[]): Promise<readonly TrackedLog[]> {
    const source = this.sources[chainId];
    if (source === undefined) throw new Error(`no log source for chain ID ${chainId}`);
    const raw = await source.getLogs({ address: [...addresses], fromBlock: 'earliest', toBlock: 'latest' });
    return raw.flatMap((log) =>
      log.transactionHash === null || log.blockNumber === null || log.logIndex === null
        ? []
        : [
            {
              address: log.address,
              topics: log.topics,
              data: log.data,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              logIndex: log.logIndex,
            },
          ],
    );
  }
}
