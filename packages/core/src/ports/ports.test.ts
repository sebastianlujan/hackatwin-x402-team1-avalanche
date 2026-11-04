import { describe, expect, it } from 'vitest';
import { createContainer } from '../container.ts';
import { money } from '../domain/money.ts';
import type { AgentIdentity } from './agent-identity.ts';
import type { AgentPolicy } from './agent-policy.ts';
import type { ChainClient } from './chain-client.ts';
import type { CrossChainMessenger, Hop } from './cross-chain-messenger.ts';
import type { LLM } from './llm.ts';
import type { PaymentGateway } from './payment-gateway.ts';
import type { PriceOracle } from './price-oracle.ts';
import { Ports } from './tokens.ts';

// Compile-only: each port is implementable and each token is typed to its interface.
class GatewayStub implements PaymentGateway {
  async pay() {
    return { status: 200, body: '' };
  }
}
class PolicyStub implements AgentPolicy {
  async authorize() {
    return { allowed: true, reason: 'ok' };
  }
  async record() {}
}
class IdentityStub implements AgentIdentity {
  async register() {
    return 1n;
  }
  async giveFeedback() {
    return '0x00' as const;
  }
  async reputation(agentId: bigint) {
    return { agentId, count: 0n, value: 0n, valueDecimals: 0 };
  }
}
class ChainStub implements ChainClient {
  readonly chainId = 1;
  async read<T>() {
    return undefined as T;
  }
  async write() {
    return '0x00' as const;
  }
  async waitForReceipt(txHash: `0x${string}`) {
    return { txHash, status: 'success' as const, blockNumber: 1n, logs: [] };
  }
}
class LlmStub implements LLM {
  async complete() {
    return { content: [], stopReason: 'end_turn' as const };
  }
}
class OracleStub implements PriceOracle {
  async quote(price: ReturnType<typeof money>) {
    return { price, rate: price, amount: price, source: 'curve' as const, guarded: false, validUntil: 0 };
  }
}
class MessengerStub implements CrossChainMessenger {
  async send() {
    return 'm1';
  }
  async *track(): AsyncIterable<Hop> {}
}

const request = { url: 'https://x', method: 'GET' as const, maxAmount: money(1n, 6, 'USD') };

describe('Ports', () => {
  it('has seven distinct tokens', () => {
    const tokens = Object.values(Ports);
    expect(tokens).toHaveLength(7);
    expect(new Set(tokens).size).toBe(7);
  });

  it('resolves a stub through its typed token', async () => {
    const container = createContainer();
    container.register(Ports.PaymentGateway, () => new GatewayStub());
    container.register(Ports.AgentPolicy, () => new PolicyStub());
    container.register(Ports.AgentIdentity, () => new IdentityStub());
    container.register(Ports.ChainClient, () => new ChainStub());
    container.register(Ports.LLM, () => new LlmStub());
    container.register(Ports.PriceOracle, () => new OracleStub());
    container.register(Ports.CrossChainMessenger, () => new MessengerStub());
    expect((await container.resolve(Ports.PaymentGateway).pay(request)).status).toBe(200);
    expect(container.resolve(Ports.ChainClient).chainId).toBe(1);
  });
});
