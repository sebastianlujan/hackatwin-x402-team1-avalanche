import { BudgetPolicy, createX402Engine, Erc8004Identity, X402PaymentGateway } from '@hackatwin/agent-kit';
import { chain, type LiveChain } from '@hackatwin/chains';
import { type Container, Ports } from '@hackatwin/core';
import { createGuardedOracle } from '@hackatwin/pricing';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { toClientEvmSigner } from '@x402/evm';
import type { LocalAccount } from 'viem';
import { createBalances } from './adapters/balances.ts';
import { createFacilitatorApp } from './adapters/facilitator-app.ts';
import { createFundingChain, fund } from './adapters/funding.ts';
import { type RoleIdentity, readIdentities, registerRoles } from './adapters/registration.ts';
import { assertSdkAddresses } from './adapters/sdk-addresses.ts';
import { createSellerApp } from './adapters/seller-app.ts';
import { createX402Facilitator, NETWORK } from './adapters/x402-facilitator.ts';
import { createBuyerTools } from './buyer-agent/tools.ts';
import { PORTS } from './ports.ts';
import { Tokens } from './tokens.ts';

export { serveLoopback } from './adapters/serve.ts';
export { runBuyer } from './buyer-agent/run.ts';
export { buyerPlan } from './buyer-agent/scripted-plan.ts';
export type { Buyer } from './tokens.ts';
export { Tokens } from './tokens.ts';

// Service URLs default to the loopback ports of the scripts; a test passes ephemeral ones.
export interface X402ModuleConfig {
  readonly facilitatorUrl?: () => string;
  readonly sellerUrl?: () => string;
}

const live = (key: string): LiveChain => chain(key) as LiveChain;
const contract = (entry: LiveChain, name: string) => {
  const found = entry.contracts[name];
  if (found === undefined) throw new Error(`registry has no ${name} on ${entry.key}`);
  return found;
};

// Registers only: the root registers Config, Accounts, Fork, ReadChains, State and Events first.
export function registerX402Module(container: Container, config: X402ModuleConfig = {}): void {
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
  container.register(Tokens.FacilitatorApp, (resolver) => {
    const cchain = live('cchain');
    assertSdkAddresses({
      permit2: contract(cchain, 'permit2').address,
      proxy: contract(cchain, 'x402Proxy').address,
    });
    const { facilitator } = resolver.resolve(Tokens.Accounts);
    return createFacilitatorApp(createX402Facilitator(resolver.resolve(Tokens.Fork), facilitator), console.error);
  });
  container.register(Tokens.SellerApp, (resolver) =>
    createSellerApp({
      oracle: resolver.resolve(Ports.PriceOracle),
      asset: contract(live('cchain'), 'argt').address,
      payTo: resolver.resolve(Tokens.Accounts).seller.address,
      facilitator: new HTTPFacilitatorClient({
        url: config.facilitatorUrl?.() ?? `http://127.0.0.1:${PORTS.facilitator}`,
      }),
    }),
  );
  container.register(Tokens.Registration, (resolver) => {
    const [fork, accounts, state] = [
      resolver.resolve(Tokens.Fork),
      resolver.resolve(Tokens.Accounts),
      resolver.resolve(Tokens.State),
    ];
    const cchain = live('cchain');
    const identityFor = (account: (typeof accounts)['agent']): RoleIdentity => {
      const adapter = new Erc8004Identity({
        chain: fork.chainClient(account),
        identity: contract(cchain, 'erc8004Identity').address,
        reputation: contract(cchain, 'erc8004Reputation').address,
        signer: account.address,
      });
      return {
        address: account.address,
        register: (uri) => adapter.register(uri),
        ownerOf: (id) => adapter.ownerOf(id),
      };
    };
    return {
      register: () =>
        registerRoles(state, { agent: identityFor(accounts.agent), seller: identityFor(accounts.seller) }),
    };
  });
  container.register(Ports.AgentPolicy, (resolver) => {
    return new BudgetPolicy(resolver.resolve(Tokens.Config).budget, resolver.resolve(Tokens.Events));
  });
  container.register(Tokens.Balances, (resolver) => {
    const accounts = resolver.resolve(Tokens.Accounts);
    return createBalances({
      chain: resolver.resolve(Tokens.Fork).chainClient(),
      token: contract(live('cchain'), 'argt').address,
      agent: accounts.agent.address,
      seller: accounts.seller.address,
    });
  });
  container.register(Tokens.Buyer, (resolver) => {
    const [profile, fork, accounts, events, policy] = [
      resolver.resolve(Tokens.Config),
      resolver.resolve(Tokens.Fork),
      resolver.resolve(Tokens.Accounts),
      resolver.resolve(Tokens.Events),
      resolver.resolve(Ports.AgentPolicy),
    ];
    const sellerAgentId = readIdentities(resolver.resolve(Tokens.State)).seller;
    if (sellerAgentId === undefined) throw new Error('the seller is not registered: run pnpm demo1:register');
    const cchain = live('cchain');
    const asset = contract(cchain, 'argt').address;
    const chainClient = fork.chainClient(accounts.agent);
    const engine = createX402Engine({
      signer: toClientEvmSigner(fork.wallet(accounts.agent).account as LocalAccount, fork.public),
      network: NETWORK,
    });
    const rating = new Erc8004Identity({
      chain: chainClient,
      identity: contract(cchain, 'erc8004Identity').address,
      reputation: contract(cchain, 'erc8004Reputation').address,
      signer: accounts.agent.address,
    });
    const tools = createBuyerTools({
      oracle: resolver.resolve(Ports.PriceOracle),
      perPayment: profile.budget.perPayment,
      url: `${config.sellerUrl?.() ?? `http://127.0.0.1:${PORTS.seller}`}/quote`,
      createGateway: (usdValue) =>
        new X402PaymentGateway({
          engine,
          chain: chainClient,
          policy,
          emit: events,
          owner: accounts.agent.address,
          asset,
          usdValue,
        }),
      rating,
      sellerAgentId,
    });
    return { tools, policy };
  });
}
