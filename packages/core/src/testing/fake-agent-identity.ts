import type { Hex } from '../domain/money.ts';
import type { AgentIdentity, Feedback, Reputation } from '../ports/agent-identity.ts';

export class FakeAgentIdentity implements AgentIdentity {
  readonly uris = new Map<bigint, string>();
  readonly feedback: Feedback[] = [];
  private nextId = 1n;

  async register(agentUri: string): Promise<bigint> {
    const id = this.nextId++;
    this.uris.set(id, agentUri);
    return id;
  }

  async giveFeedback(feedback: Feedback): Promise<Hex> {
    if (!this.uris.has(feedback.agentId)) throw new Error(`Unknown agent ${feedback.agentId}`);
    this.feedback.push(feedback);
    return `0x${this.feedback.length.toString(16).padStart(64, '0')}`;
  }

  async reputation(agentId: bigint): Promise<Reputation> {
    const own = this.feedback.filter((f) => f.agentId === agentId);
    const value = own.reduce((sum, f) => sum + f.value, 0n);
    return { agentId, count: BigInt(own.length), value, valueDecimals: own.at(-1)?.valueDecimals ?? 0 };
  }
}
