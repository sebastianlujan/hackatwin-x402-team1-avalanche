import type { Container } from '@hackatwin/core';
import type { Account } from 'viem';
import { createIcttFunding } from './adapters/ictt-funding.ts';
import { Tokens } from './tokens.ts';

// Registers only: the root registers World and Hub first, and nothing is resolved here.
export function registerCrossChainModule(container: Container): void {
  container.register(Tokens.Router, (resolver) => resolver.resolve(Tokens.World).contracts.router);
  container.register(Tokens.Lanes, (resolver) => {
    const { chains, contracts } = resolver.resolve(Tokens.World);
    return { [chains.l1.chainId]: BigInt(contracts.selector) };
  });
  container.register(Tokens.Funding, (resolver) => {
    const { chains, contracts, roles } = resolver.resolve(Tokens.World);
    const hub = resolver.resolve(Tokens.Hub);
    const treasury = { address: roles.treasury, type: 'json-rpc' } as Account;
    return createIcttFunding({
      client: hub.chainClient(treasury),
      token: contracts.usdc,
      home: contracts.home,
      remote: contracts.remote,
      destination: chains.l1.blockchainId,
      owner: roles.treasury,
    });
  });
}
