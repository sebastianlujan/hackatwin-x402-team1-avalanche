import type { ChainClient } from '@hackatwin/core';
import { type ChainlinkFeedAddresses, ChainlinkFeedOracle } from './chainlink-feed-oracle.ts';
import { type CurvePoolAddresses, CurvePoolOracle } from './curve-pool-oracle.ts';
import { GuardedOracle } from './guarded-oracle.ts';

export interface GuardedOracleOptions {
  readonly arbitrum: ChainClient;
  readonly base: ChainClient;
  readonly addresses: { readonly curve: CurvePoolAddresses; readonly chainlink: ChainlinkFeedAddresses };
  readonly now?: () => number;
}

export function createGuardedOracle({ arbitrum, base, addresses, now }: GuardedOracleOptions): GuardedOracle {
  const clock = now ?? Date.now;
  return new GuardedOracle(
    new CurvePoolOracle(arbitrum, addresses.curve),
    new ChainlinkFeedOracle(base, addresses.chainlink, clock),
    clock,
  );
}
