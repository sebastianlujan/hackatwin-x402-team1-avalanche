import { chain, createChainClient, type LiveChain } from '@hackatwin/chains';
import { loadRpcUrls } from '@hackatwin/config';
import { createGuardedOracle, describeFailure, type GuardedOracle, runQuote } from '@hackatwin/pricing';

const live = (key: string): LiveChain => chain(key) as LiveChain;
const address = (entry: LiveChain, name: string) => {
  const found = entry.contracts[name];
  if (found === undefined) throw new Error(`registry has no ${name} on ${entry.key}`);
  return found;
};

async function build(): Promise<GuardedOracle> {
  const arbitrum = live('arbitrum');
  const base = live('base');
  const urls = loadRpcUrls({ arbitrum: arbitrum.rpc.public, base: base.rpc.public });
  const feed = address(base, 'arsUsdFeed');
  return createGuardedOracle({
    arbitrum: await createChainClient({ chain: 'arbitrum', rpcUrl: urls.arbitrum as string }),
    base: await createChainClient({ chain: 'base', rpcUrl: urls.base as string }),
    addresses: {
      curve: {
        pool: address(arbitrum, 'curveArgtUsdt0Pool').address,
        argt: address(arbitrum, 'argt').address,
        usdt0: address(arbitrum, 'usdt0').address,
      },
      chainlink: {
        feed: feed.address,
        sequencer: address(base, 'sequencerFeed').address,
        heartbeatSeconds: feed.heartbeatSeconds as number,
      },
    },
  });
}

try {
  const oracle = await build();
  process.exitCode = await runQuote(oracle, { out: console.log, err: console.error });
} catch (error) {
  console.error(describeFailure(error));
  process.exitCode = 1;
}
