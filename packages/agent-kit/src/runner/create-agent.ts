import type { AgentEvent, AgentPolicy, LLM, LlmContent, LlmMessage } from '@hackatwin/core';
import type { EventChannel } from './event-channel.ts';
import { type Tool, toToolSpec } from './tool.ts';

export interface AgentOptions {
  readonly llm: LLM;
  readonly llmName: 'claude' | 'scripted';
  readonly tools: readonly Tool<never>[];
  readonly policy: AgentPolicy;
  readonly channel: EventChannel;
  readonly system: string;
  readonly prompt: string;
  readonly agent: string;
  readonly profile: string;
  readonly maxSteps?: number;
}

type ToolUse = Extract<LlmContent, { type: 'tool_use' }>;
type Finished = Extract<AgentEvent, { type: 'run.finished' }>;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Runs LLM calls and tools until the model stops, a guard trips, or something fails; every path ends in run.finished.
export async function* createAgent(options: AgentOptions): AsyncGenerator<AgentEvent, void> {
  const { llm, channel, policy } = options;
  const maxSteps = options.maxSteps ?? 8;
  const tools = new Map(options.tools.map((tool) => [tool.name, tool]));
  const specs = options.tools.map(toToolSpec);
  const emit = channel.emit;
  const finish = (reason: Finished['reason'], message?: string): void =>
    emit({ version: 1, type: 'run.finished', at: Date.now(), reason, ...(message !== undefined && { message }) });
  const flush = (): AsyncGenerator<AgentEvent, void> => channel.until(Promise.resolve());

  emit({
    version: 1,
    type: 'run.started',
    at: Date.now(),
    agent: options.agent,
    profile: options.profile,
    llm: options.llmName,
  });
  yield* flush();

  const messages: LlmMessage[] = [{ role: 'user', content: [{ type: 'text', text: options.prompt }] }];
  for (let step = 1; step <= maxSteps; step++) {
    let reply: Awaited<ReturnType<LLM['complete']>>;
    try {
      reply = yield* channel.until(llm.complete({ system: options.system, messages: [...messages], tools: specs }));
    } catch (error) {
      finish('error', messageOf(error));
      yield* flush();
      return;
    }
    messages.push({ role: 'assistant', content: reply.content });
    if (reply.reasoning !== undefined)
      emit({ version: 1, type: 'llm.reasoning', at: Date.now(), text: reply.reasoning });
    const uses = reply.content.filter((part): part is ToolUse => part.type === 'tool_use');
    const text = reply.content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
    if (uses.length > 0 && text !== '') emit({ version: 1, type: 'llm.reasoning', at: Date.now(), text });

    const calls: { use: ToolUse; tool: Tool<never>; input: never }[] = [];
    let bad: string | undefined;
    for (const use of uses) {
      const tool = tools.get(use.name);
      const parsed = tool?.input.safeParse(use.input);
      emit({
        version: 1,
        type: 'llm.tool-call',
        at: Date.now(),
        tool: use.name,
        input: parsed?.success === true ? parsed.data : use.input,
      });
      if (tool === undefined) bad ??= `unknown tool "${use.name}"`;
      else if (parsed?.success !== true) bad ??= `invalid input for tool "${use.name}"`;
      else calls.push({ use, tool, input: parsed.data });
    }
    if (reply.stopReason === 'refusal') {
      finish('refusal', 'the model refused the request');
      yield* flush();
      return;
    }
    if (bad !== undefined) {
      finish('error', bad);
      yield* flush();
      return;
    }
    if (uses.length === 0) {
      if (reply.stopReason === 'max_tokens') finish('error', 'the reply was cut off at the token limit');
      else finish('done', text === '' ? undefined : text);
      yield* flush();
      return;
    }

    const results: LlmContent[] = [];
    for (const { use, tool, input } of calls) {
      try {
        const content = yield* channel.until(tool.run(input, { emit, policy }));
        results.push({ type: 'tool_result', toolUseId: use.id, content, isError: false });
      } catch (error) {
        results.push({ type: 'tool_result', toolUseId: use.id, content: messageOf(error), isError: true });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  finish('max-steps', `stopped after ${maxSteps} steps`);
  yield* flush();
}
