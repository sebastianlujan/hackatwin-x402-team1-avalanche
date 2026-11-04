import type { LLM, LlmContent, LlmMessage, LlmReply } from '@hackatwin/core';
import { LlmError } from './errors.ts';

export interface PlanReply {
  readonly reasoning: string;
  readonly text?: string;
  readonly calls?: readonly { readonly name: string; readonly input: unknown }[];
}

// A step sees the whole conversation so far, so a plan can react to a failed tool.
export type PlanStep = (messages: readonly LlmMessage[]) => PlanReply;

export interface ToolOutcome {
  readonly name: string;
  readonly content: string;
  readonly isError: boolean;
}

// Pairs every tool_result in the conversation with the name of the tool that produced it.
export function toolOutcomes(messages: readonly LlmMessage[]): ToolOutcome[] {
  const names = new Map<string, string>();
  const outcomes: ToolOutcome[] = [];
  for (const message of messages) {
    for (const part of message.content) {
      if (part.type === 'tool_use') names.set(part.id, part.name);
      else if (part.type === 'tool_result') {
        outcomes.push({ name: names.get(part.toolUseId) ?? '', content: part.content, isError: part.isError });
      }
    }
  }
  return outcomes;
}

// A labeled LLM adapter on the live path (ADR 0008): deterministic, no network, no secrets.
export class ScriptedPlanLLM implements LLM {
  private readonly plan: readonly PlanStep[];
  private next = 0;

  constructor(plan: readonly PlanStep[]) {
    this.plan = plan;
  }

  async complete({ messages }: { readonly messages: readonly LlmMessage[] }): Promise<LlmReply> {
    const index = this.next++;
    const step = this.plan[index];
    if (step === undefined) throw new LlmError('the scripted plan has no step left');
    const { reasoning, text, calls = [] } = step(messages);
    const content: LlmContent[] = [
      ...(text === undefined ? [] : [{ type: 'text' as const, text }]),
      ...calls.map((call, i) => ({
        type: 'tool_use' as const,
        id: `scripted-${index}-${i}`,
        name: call.name,
        input: call.input,
      })),
    ];
    return {
      content,
      reasoning: reasoning.startsWith('Scripted plan:') ? reasoning : `Scripted plan: ${reasoning}`,
      stopReason: calls.length > 0 ? 'tool_use' : 'end_turn',
    };
  }
}
