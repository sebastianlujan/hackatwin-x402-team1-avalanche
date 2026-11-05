import type { Hex } from '../domain/money.ts';

export interface Feedback {
  readonly agentId: bigint;
  readonly value: bigint;
  readonly valueDecimals: number;
  readonly tag1: string;
  readonly tag2: string;
}

export interface Reputation {
  readonly agentId: bigint;
  readonly count: bigint;
  readonly value: bigint;
  readonly valueDecimals: number;
}

export interface AgentIdentity {
  register(agentUri: string): Promise<bigint>;
  giveFeedback(feedback: Feedback): Promise<Hex>;
  reputation(agentId: bigint): Promise<Reputation>;
}
