import Anthropic, { APIError } from '@anthropic-ai/sdk';
import type { ContentBlock, ContentBlockParam, MessageParam, StopReason } from '@anthropic-ai/sdk/resources/messages';
import type { LLM, LlmContent, LlmMessage, LlmReply, LlmRequest } from '@hackatwin/core';
import { LlmError } from './errors.ts';

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5';

export interface ClaudeLlmOptions {
  readonly apiKey: string | undefined;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly fetch?: typeof fetch;
}

const STOP: Readonly<Record<StopReason, LlmReply['stopReason']>> = {
  end_turn: 'end_turn',
  stop_sequence: 'end_turn',
  pause_turn: 'end_turn',
  tool_use: 'tool_use',
  max_tokens: 'max_tokens',
  model_context_window_exceeded: 'max_tokens',
  refusal: 'refusal',
};

const plain = (content: LlmContent): ContentBlockParam =>
  content.type === 'text'
    ? { type: 'text', text: content.text }
    : content.type === 'tool_use'
      ? { type: 'tool_use', id: content.id, name: content.name, input: content.input }
      : { type: 'tool_result', tool_use_id: content.toolUseId, content: content.content, is_error: content.isError };

// 1.4.0 shapes: thinking is { type, thinking, signature } and redacted_thinking is { type, data }.
const replay = (block: ContentBlock): ContentBlockParam | undefined => {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'thinking':
      return { type: 'thinking', thinking: block.thinking, signature: block.signature };
    case 'redacted_thinking':
      return { type: 'redacted_thinking', data: block.data };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    default:
      return undefined;
  }
};

export class ClaudeLLM implements LLM {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  // Raw assistant blocks by tool_use id, replayed so thinking signatures survive without widening the port.
  private readonly raw = new Map<string, ContentBlockParam[]>();

  constructor(options: ClaudeLlmOptions) {
    if (options.apiKey === undefined || options.apiKey === '') {
      throw new LlmError('ANTHROPIC_API_KEY is required to run the Claude LLM');
    }
    this.client = new Anthropic({
      apiKey: options.apiKey,
      maxRetries: 3,
      ...(options.fetch !== undefined && { fetch: options.fetch }),
    });
    this.model = options.model ?? DEFAULT_CLAUDE_MODEL;
    this.maxTokens = options.maxTokens ?? 4096;
  }

  async complete(request: LlmRequest): Promise<LlmReply> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: request.system,
        messages: request.messages.map((entry) => this.param(entry)),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: { type: 'object', ...tool.inputSchema },
        })),
        tool_choice: { type: 'auto' },
        thinking: { type: 'adaptive', display: 'summarized' },
      });
    } catch (error) {
      if (error instanceof APIError && error.status !== undefined) {
        throw new LlmError(`Claude request failed after retries (HTTP ${error.status})`, error.status);
      }
      throw new LlmError('Claude request failed (connection error)');
    }
    return this.reply(message);
  }

  private param(entry: LlmMessage): MessageParam {
    if (entry.role === 'assistant') {
      for (const part of entry.content) {
        const kept = part.type === 'tool_use' ? this.raw.get(part.id) : undefined;
        if (kept !== undefined) return { role: 'assistant', content: kept };
      }
    }
    return { role: entry.role, content: entry.content.map(plain) };
  }

  private reply(message: Anthropic.Message): LlmReply {
    const content: LlmContent[] = [];
    const thinking: string[] = [];
    for (const block of message.content) {
      if (block.type === 'text') content.push({ type: 'text', text: block.text });
      else if (block.type === 'tool_use')
        content.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
      else if (block.type === 'thinking' && block.thinking !== '') thinking.push(block.thinking);
    }
    const blocks = message.content.map(replay).filter((block): block is ContentBlockParam => block !== undefined);
    for (const part of content) if (part.type === 'tool_use') this.raw.set(part.id, blocks);
    const reasoning = thinking.join('\n');
    return {
      content,
      ...(reasoning !== '' && { reasoning }),
      stopReason: message.stop_reason === null ? 'end_turn' : STOP[message.stop_reason],
    };
  }
}
