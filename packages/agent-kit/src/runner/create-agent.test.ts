import { type AgentEvent, type LlmReply, money } from '@hackatwin/core';
import { FakeAgentPolicy, ScriptedLLM } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createAgent } from './create-agent.ts';
import { createEventChannel } from './event-channel.ts';
import { defineTool, type Tool, toToolSpec } from './tool.ts';

const call = (name: string, input: unknown, id = 't1'): LlmReply => ({
  content: [{ type: 'tool_use', id, name, input }],
  stopReason: 'tool_use',
});
const final = (text: string): LlmReply => ({ content: [{ type: 'text', text }], stopReason: 'end_turn' });

interface Run {
  readonly events: AgentEvent[];
  readonly ran: unknown[];
  readonly llm: ScriptedLLM;
}

async function run(replies: LlmReply[], options: { maxSteps?: number; tools?: Tool<never>[] } = {}): Promise<Run> {
  const ran: unknown[] = [];
  const echo = defineTool({
    name: 'echo',
    description: 'Echo a word',
    input: z.object({ word: z.string() }),
    async run(input, { emit }) {
      ran.push(input);
      emit({ version: 1, type: 'resource.received', at: 2, resource: 'echo', status: 200 });
      return `echoed ${input.word}`;
    },
  });
  const llm = new ScriptedLLM(replies);
  const stream = createAgent({
    llm,
    llmName: 'scripted',
    tools: options.tools ?? [echo],
    policy: new FakeAgentPolicy(),
    channel: createEventChannel(),
    system: 'sys',
    prompt: 'go',
    agent: 'buyer',
    profile: 'cchain-fork',
    ...(options.maxSteps !== undefined && { maxSteps: options.maxSteps }),
  });
  const events: AgentEvent[] = [];
  for await (const event of stream) events.push(event);
  return { events, ran, llm };
}

const types = (events: AgentEvent[]): string[] => events.map((event) => event.type);

describe('createAgent events', () => {
  it('runs from run.started through the tool to a done terminal event', async () => {
    const { events, ran } = await run([call('echo', { word: 'hi' }), final('all done')]);
    expect(types(events)).toEqual(['run.started', 'llm.tool-call', 'resource.received', 'run.finished']);
    expect(events[0]).toMatchObject({ agent: 'buyer', profile: 'cchain-fork', llm: 'scripted' });
    expect(events.at(-1)).toMatchObject({ reason: 'done', message: 'all done' });
    expect(ran).toEqual([{ word: 'hi' }]);
  });

  it('emits reasoning before the tool calls, once per reply', async () => {
    const reply: LlmReply = { ...call('echo', { word: 'x' }), reasoning: 'thinking about it' };
    const { events } = await run([reply, final('ok')]);
    expect(types(events).slice(0, 3)).toEqual(['run.started', 'llm.reasoning', 'llm.tool-call']);
  });

  it('feeds the tool result back to the next request', async () => {
    const { llm } = await run([call('echo', { word: 'hi' }), final('ok')]);
    expect(llm.requests[1]?.messages.at(-1)?.content).toEqual([
      { type: 'tool_result', toolUseId: 't1', content: 'echoed hi', isError: false },
    ]);
    expect(llm.requests[0]?.tools.map((tool) => tool.name)).toEqual(['echo']);
  });
});

describe('createAgent bad tool calls', () => {
  it('ends with error and runs nothing for an unknown tool', async () => {
    const { events, ran } = await run([call('delete_all', {})]);
    expect(events.at(-1)).toMatchObject({
      type: 'run.finished',
      reason: 'error',
      message: 'unknown tool "delete_all"',
    });
    expect(ran).toEqual([]);
  });

  it('ends with error and runs nothing for invalid input', async () => {
    const { events, ran } = await run([call('echo', { word: 7 })]);
    expect(events.at(-1)).toMatchObject({ reason: 'error', message: 'invalid input for tool "echo"' });
    expect(ran).toEqual([]);
  });

  it('runs none of a reply that mixes a good and a bad call', async () => {
    const reply: LlmReply = {
      stopReason: 'tool_use',
      content: [
        { type: 'tool_use', id: 'a', name: 'echo', input: { word: 'ok' } },
        { type: 'tool_use', id: 'b', name: 'nope', input: {} },
      ],
    };
    const { ran, events } = await run([reply]);
    expect(ran).toEqual([]);
    expect(events.at(-1)).toMatchObject({ reason: 'error' });
  });

  it('strips unknown input keys instead of failing', async () => {
    const { ran } = await run([call('echo', { word: 'hi', cap: 1000 }), final('ok')]);
    expect(ran).toEqual([{ word: 'hi' }]);
  });
});

describe('createAgent guards', () => {
  it('stops after maxSteps with max-steps', async () => {
    const replies = [1, 2, 3, 4].map((n) => call('echo', { word: 'again' }, `t${n}`));
    const { events, llm } = await run(replies, { maxSteps: 3 });
    expect(events.at(-1)).toMatchObject({ reason: 'max-steps', message: 'stopped after 3 steps' });
    expect(llm.requests).toHaveLength(3);
  });

  it('defaults to 8 steps', async () => {
    const replies = Array.from({ length: 9 }, (_, n) => call('echo', { word: 'again' }, `t${n}`));
    const { events } = await run(replies);
    expect(events.at(-1)).toMatchObject({ reason: 'max-steps', message: 'stopped after 8 steps' });
  });

  it('ends with refusal and no further step', async () => {
    const { events, llm } = await run([{ content: [], stopReason: 'refusal' }, final('never')]);
    expect(events.at(-1)).toMatchObject({ reason: 'refusal' });
    expect(llm.requests).toHaveLength(1);
  });

  it('ends with error when the LLM throws', async () => {
    const { events } = await run([]);
    expect(events.at(-1)).toMatchObject({ reason: 'error', message: 'ScriptedLLM has no scripted reply left' });
  });

  it('ends with error when the reply is cut off', async () => {
    const { events } = await run([{ content: [], stopReason: 'max_tokens' }]);
    expect(events.at(-1)).toMatchObject({ reason: 'error' });
  });

  it('turns a tool failure into an error result and lets the model continue', async () => {
    const failing = defineTool({
      name: 'fail',
      description: 'Always fails',
      input: z.object({}),
      async run() {
        throw new Error(`denied ${money(1n, 0, 'USD').units}`);
      },
    });
    const { events, llm } = await run([call('fail', {}), final('gave up')], { tools: [failing] });
    expect(events.at(-1)).toMatchObject({ reason: 'done', message: 'gave up' });
    expect(llm.requests[1]?.messages.at(-1)?.content).toEqual([
      { type: 'tool_result', toolUseId: 't1', content: 'denied 1', isError: true },
    ]);
  });
});

describe('toToolSpec', () => {
  it('builds a JSON schema without $schema', () => {
    const [tool] = [
      defineTool({ name: 'echo', description: 'd', input: z.object({ word: z.string() }), run: async () => '' }),
    ];
    const spec = toToolSpec(tool as never);
    expect(spec).toMatchObject({ name: 'echo', inputSchema: { type: 'object', properties: { word: {} } } });
    expect(spec.inputSchema).not.toHaveProperty('$schema');
  });
});
