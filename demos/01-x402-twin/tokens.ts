import type { Tool } from '@hackatwin/agent-kit';
import type { GuardedClients } from '@hackatwin/chains';
import type { Profile } from '@hackatwin/config';
import { type AgentEvent, type AgentPolicy, type ChainClient, token } from '@hackatwin/core';
import type { Hono } from 'hono';
import type { LocalAccount } from 'viem';
import type { Balances } from './adapters/balances.ts';
import type { FundingReport } from './adapters/funding.ts';
import type { RegistrationReport } from './adapters/registration.ts';
import type { DemoState, Role } from './state.ts';

export interface Buyer {
  readonly tools: readonly Tool<never>[];
  readonly policy: AgentPolicy;
}

export const Tokens = {
  Config: token<Profile<'cchain-fork'>>('Config'),
  Accounts: token<Readonly<Record<Role, LocalAccount>>>('Accounts'),
  Fork: token<GuardedClients>('Fork'),
  ReadChains: token<{ readonly arbitrum: ChainClient; readonly base: ChainClient }>('ReadChains'),
  State: token<DemoState>('State'),
  Events: token<(event: AgentEvent) => void>('Events'),
  Funding: token<{ fund(): Promise<FundingReport> }>('Funding'),
  Registration: token<{ register(): Promise<RegistrationReport> }>('Registration'),
  FacilitatorApp: token<Hono>('FacilitatorApp'),
  SellerApp: token<Hono>('SellerApp'),
  Buyer: token<Buyer>('Buyer'),
  Balances: token<Balances>('Balances'),
} as const;
