import { chain, type LiveChain } from '@hackatwin/chains';
import { type Container, Ports } from '@hackatwin/core';
import { createGuardedOracle } from '@hackatwin/pricing';
import { createFundingChain, fund } from './adapters/funding.ts';
import { Tokens } from './tokens.ts';

const live = (key: string): LiveChain => chain(key) as LiveChain;
const contract = (entry: LiveChain, name: string) => {
  const found = entry.contracts[name];
  if (found === undefined) throw new Error(`registry has no ${name} on ${entry.key}`);
  return found;
};

// Registers only: the root registers Config, Accounts, Fork, ReadChains, State and Events first.
export function registerX402Module(container: Container): void {
  container.register(Ports.PriceOracle, (resolver) => {
    const { arbitrum, base } = resolver.resolve(Tokens.ReadChains);
    const [arb, feedChain] = [live('arbitrum'), live('base')];
    const feed = contract(feedChain, 'arsUsdFeed');
    return createGuardedOracle({
      arbitrum,
      base,
      addresses: {
        curve: {
          pool: contract(arb, 'curveArgtUsdt0Pool').address,
          argt: contract(arb, 'argt').address,
          usdt0: contract(arb, 'usdt0').address,
        },
        chainlink: {
          feed: feed.address,
          sequencer: contract(feedChain, 'sequencerFeed').address,
          heartbeatSeconds: feed.heartbeatSeconds as number,
        },
      },
    });
  });
  container.register(Tokens.Funding, (resolver) => {
    const profile = resolver.resolve(Tokens.Config);
    const accounts = resolver.resolve(Tokens.Accounts);
    const cchain = live('cchain');
    const adapter = contract(cchain, 'twinAdapter').address;
    const roles = [accounts.agent.address, accounts.seller.address, accounts.facilitator.address, adapter];
    const chainOptions = {
      fork: resolver.resolve(Tokens.Fork),
      token: contract(cchain, 'argt').address,
      permit2: contract(cchain, 'permit2').address,
      adapter,
      agent: accounts.agent,
    };
    const [oracle, state] = [resolver.resolve(Ports.PriceOracle), resolver.resolve(Tokens.State)];
    return {
      fund: () =>
        fund({
          chain: createFundingChain(chainOptions),
          oracle,
          state,
          budgetTotal: profile.budget.total,
          forkBlock: profile.forkBlock,
          agent: accounts.agent.address,
          gasFor: roles,
        }),
    };
  });
}
