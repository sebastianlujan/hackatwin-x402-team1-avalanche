import { chain, createChainClient } from '@hackatwin/chains';
import { describe, expect, it } from 'vitest';
import { CurvePoolOracle } from '../src/curve-pool-oracle.ts';

describe('CurvePoolOracle on Arbitrum', () => {
  it('reads a plausible ARGt per USD live', async () => {
    const arbitrum = chain('arbitrum');
    const { contracts, rpc } = arbitrum as Extract<typeof arbitrum, { status: 'live' }>;
    const client = await createChainClient({ chain: 'arbitrum', rpcUrl: rpc.public });
    const reading = await new CurvePoolOracle(client, {
      pool: contracts.curveArgtUsdt0Pool?.address as `0x${string}`,
      argt: contracts.argt?.address as `0x${string}`,
      usdt0: contracts.usdt0?.address as `0x${string}`,
    }).reading();
    console.log(`curve ${reading.argtPerUsd} at block ${reading.blockNumber}`);
    expect(reading.chainId).toBe(42161);
    expect(reading.argtPerUsd).toBeGreaterThan(500n * 10n ** 18n);
    expect(reading.argtPerUsd).toBeLessThan(5000n * 10n ** 18n);
  });
});
