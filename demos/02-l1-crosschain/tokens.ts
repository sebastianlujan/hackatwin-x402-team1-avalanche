import type { GuardedClients } from '@hackatwin/chains';
import { type Address, token } from '@hackatwin/core';
import type { IcttFunding } from './adapters/ictt-funding.ts';
import type { Lanes } from './adapters/sender.ts';
import type { World } from './deployment.ts';

export const Tokens = {
  World: token<World>('World'),
  Hub: token<GuardedClients>('Hub'),
  Router: token<Address>('Router'),
  Lanes: token<Lanes>('Lanes'),
  Funding: token<IcttFunding>('Funding'),
} as const;
