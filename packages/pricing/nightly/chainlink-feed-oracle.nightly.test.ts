import { chain, createChainClient } from '@hackatwin/chains';
import { describe, expect, it } from 'vitest';
import { ChainlinkFeedOracle } from '../src/chainlink-feed-oracle.ts';
import { CurvePoolOracle } from '../src/curve-pool-oracle.ts';

const live = (key: string) => chain(key) as Extract<ReturnType<typeof chain>, { status: 'live' }>;

describe('ChainlinkFeedOracle on Base', () => {
  it('reads a rate within 2% of Curve', async () => {
    const base = live('base');
    const arb = live('arbitrum');
    const baseClient = await createChainClient({ chain: 'base', rpcUrl: base.rpc.public });
    const arbClient = await createChainClient({ chain: 'arbitrum', rpcUrl: arb.rpc.public });
    const feed = base.contracts.arsUsdFeed;
    const chainlink = await new ChainlinkFeedOracle(baseClient, {
      feed: feed?.address as `0x${string}`,
      sequencer: base.contracts.sequencerFeed?.address as `0x${string}`,
      heartbeatSeconds: feed?.heartbeatSeconds as number,
    }).reading();
    const curve = await new CurvePoolOracle(arbClient, {
      pool: arb.contracts.curveArgtUsdt0Pool?.address as `0x${string}`,
      argt: arb.contracts.argt?.address as `0x${string}`,
      usdt0: arb.contracts.usdt0?.address as `0x${string}`,
    }).reading();
    const deltaBps = ((curve.argtPerUsd - chainlink.argtPerUsd) * 10000n) / chainlink.argtPerUsd;
    console.log(
      `chainlink ${chainlink.argtPerUsd} at base block ${chainlink.blockNumber}, curve ${curve.argtPerUsd}, delta ${deltaBps} bps`,
    );
    expect(deltaBps < 200n && deltaBps > -200n).toBe(true);
  });
});
