// argtPerUsd has 18 decimals
export interface RateReading {
  readonly source: 'curve' | 'chainlink';
  readonly argtPerUsd: bigint;
  readonly chainId: number;
  readonly blockNumber: bigint;
}

export interface RateSource {
  reading(): Promise<RateReading>;
}
