import { token } from '../container.ts';
import type { AgentIdentity } from './agent-identity.ts';
import type { AgentPolicy } from './agent-policy.ts';
import type { ChainClient } from './chain-client.ts';
import type { CrossChainMessenger } from './cross-chain-messenger.ts';
import type { LLM } from './llm.ts';
import type { PaymentGateway } from './payment-gateway.ts';
import type { PriceOracle } from './price-oracle.ts';

export const Ports = {
  PaymentGateway: token<PaymentGateway>('PaymentGateway'),
  AgentIdentity: token<AgentIdentity>('AgentIdentity'),
  AgentPolicy: token<AgentPolicy>('AgentPolicy'),
  ChainClient: token<ChainClient>('ChainClient'),
  LLM: token<LLM>('LLM'),
  PriceOracle: token<PriceOracle>('PriceOracle'),
  CrossChainMessenger: token<CrossChainMessenger>('CrossChainMessenger'),
} as const;
