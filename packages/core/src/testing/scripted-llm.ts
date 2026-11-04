import type { LLM, LlmReply, LlmRequest } from '../ports/llm.ts';

export class ScriptedLLM implements LLM {
  readonly requests: LlmRequest[] = [];
  private readonly replies: LlmReply[];

  constructor(replies: readonly LlmReply[]) {
    this.replies = [...replies];
  }

  async complete(request: LlmRequest): Promise<LlmReply> {
    this.requests.push(request);
    const next = this.replies.shift();
    if (!next) throw new Error('ScriptedLLM has no scripted reply left');
    return next;
  }
}
