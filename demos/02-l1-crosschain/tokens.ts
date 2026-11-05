import { type Address, token } from '@hackatwin/core';
import type { Lanes } from './adapters/sender.ts';

export const Tokens = {
  Router: token<Address>('Router'),
  Lanes: token<Lanes>('Lanes'),
} as const;
