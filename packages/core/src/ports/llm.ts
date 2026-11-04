export type LlmContent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'tool_use'; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly type: 'tool_result'; readonly toolUseId: string; readonly content: string; readonly isError: boolean };

export interface LlmMessage {
  readonly role: 'user' | 'assistant';
  readonly content: readonly LlmContent[];
}

export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export interface LlmRequest {
  readonly system: string;
  readonly messages: readonly LlmMessage[];
  readonly tools: readonly ToolSpec[];
}

export interface LlmReply {
  readonly content: readonly LlmContent[];
  readonly reasoning?: string;
  readonly stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal';
}

export interface LLM {
  complete(request: LlmRequest): Promise<LlmReply>;
}
