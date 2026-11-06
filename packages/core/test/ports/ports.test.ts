import { describe, expect, it } from 'vitest';
import { createContainer } from '../../src/container.ts';
import { money } from '../../src/domain/money.ts';
import type { AgentIdentity } from '../../src/ports/agent-identity.ts';
import type { AgentPolicy } from '../../src/ports/agent-policy.ts';
import type { ChainClient, ReadResult } from '../../src/ports/chain-client.ts';
import type { CrossChainMessenger, Hop } from '../../src/ports/cross-chain-messenger.ts';
import type { LLM } from '../../src/ports/llm.ts';
import type { PaymentGateway } from '../../src/ports/payment-gateway.ts';
import type { PriceOracle } from '../../src/ports/price-oracle.ts';
import { Ports } from '../../src/ports/tokens.ts';

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
  async blockNumber() {
    return 1n;
  }
  async read<T>() {
    return { value: undefined as T, blockNumber: 1n };
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

describe('ChainClient', () => {
  const call = { address: `0x${'1'.repeat(40)}` as const, abi: [], functionName: 'f' };

  it('reads at the head or at a pinned block and reports the block', async () => {
    const chain: ChainClient = new ChainStub();
    const head: ReadResult<string> = await chain.read<string>(call);
    const pinned = await chain.read<string>(call, { blockNumber: 7n });
    expect([head.blockNumber, pinned.blockNumber]).toEqual([1n, 1n]);
    expect(await chain.blockNumber()).toBe(1n);
  });
});

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
