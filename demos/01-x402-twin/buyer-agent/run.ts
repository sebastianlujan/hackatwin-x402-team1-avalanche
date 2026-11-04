import { createAgent, type EventChannel } from '@hackatwin/agent-kit';
import type { AgentEvent, Container, LLM } from '@hackatwin/core';
import { Tokens } from '../tokens.ts';
import { PROMPT, SYSTEM } from './prompt.ts';

export interface RunBuyerOptions {
  readonly container: Container;
  readonly channel: EventChannel;
  readonly llm: LLM;
  readonly llmName: 'claude' | 'scripted';
}

// The buyer run shared by `pnpm demo1` and the protocol E2E.
export function runBuyer({ container, channel, llm, llmName }: RunBuyerOptions): AsyncIterable<AgentEvent> {
  const buyer = container.resolve(Tokens.Buyer);
  return createAgent({
    llm,
    llmName,
    tools: buyer.tools,
    policy: buyer.policy,
    channel,
    system: SYSTEM,
    prompt: PROMPT,
    agent: 'buyer',
    profile: container.resolve(Tokens.Config).name,
  });
}
