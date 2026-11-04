import type { LlmRequest } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { ClaudeLLM, DEFAULT_CLAUDE_MODEL } from './claude-llm.ts';
import { LlmError } from './errors.ts';

const KEY = 'sk-ant-test-secret-1234';
const request: LlmRequest = {
  system: 'You buy quotes.',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'buy one' }] }],
  tools: [{ name: 'quote', description: 'Get a quote', inputSchema: { properties: {} } }],
};

const message = (content: unknown[], stopReason: string) =>
  new Response(
    JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const failure = (status: number) =>
  new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: `key ${KEY}` } }), {
    status,
    headers: { 'content-type': 'application/json', 'retry-after-ms': '1' },
  });

// A fake transport under the real SDK client, so the SDK retry policy is the one under test.
function transport(replies: (() => Response)[]) {
  const bodies: Record<string, unknown>[] = [];
  const send = async (_url: unknown, init?: { body?: unknown }): Promise<Response> => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const next = replies[Math.min(bodies.length, replies.length) - 1];
    if (next === undefined) throw new Error('no reply scripted');
    return next();
  };
  return { bodies, send: send as unknown as typeof fetch };
}

describe('ClaudeLLM request', () => {
  it('uses tool_choice auto and the default model', async () => {
    const { bodies, send } = transport([() => message([{ type: 'text', text: 'hi' }], 'end_turn')]);
    await new ClaudeLLM({ apiKey: KEY, fetch: send }).complete(request);
    expect(bodies[0]).toMatchObject({
      model: DEFAULT_CLAUDE_MODEL,
      tool_choice: { type: 'auto' },
      system: 'You buy quotes.',
      tools: [{ name: 'quote', input_schema: { type: 'object' } }],
    });
  });

  it('uses the model from config', async () => {
    const { bodies, send } = transport([() => message([], 'end_turn')]);
    await new ClaudeLLM({ apiKey: KEY, model: 'claude-opus-5-5', fetch: send }).complete(request);
    expect(bodies[0]).toMatchObject({ model: 'claude-opus-5-5' });
  });

  it('fails naming ANTHROPIC_API_KEY without a key', () => {
    expect(() => new ClaudeLLM({ apiKey: undefined })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => new ClaudeLLM({ apiKey: '' })).toThrow(LlmError);
  });
});

describe('ClaudeLLM reply', () => {
  it('maps thinking to reasoning and keeps content order', async () => {
    const { send } = transport([
      () =>
        message(
          [
            { type: 'thinking', thinking: 'I need a quote first', signature: 'sig-1' },
            { type: 'text', text: 'Fetching' },
            { type: 'tool_use', id: 'tu_1', name: 'quote', input: {}, caller: { type: 'direct' } },
          ],
          'tool_use',
        ),
    ]);
    const reply = await new ClaudeLLM({ apiKey: KEY, fetch: send }).complete(request);
    expect(reply).toEqual({
      content: [
        { type: 'text', text: 'Fetching' },
        { type: 'tool_use', id: 'tu_1', name: 'quote', input: {} },
      ],
      reasoning: 'I need a quote first',
      stopReason: 'tool_use',
    });
  });

  it('maps a refusal stop reason', async () => {
    const { send } = transport([() => message([], 'refusal')]);
    expect((await new ClaudeLLM({ apiKey: KEY, fetch: send }).complete(request)).stopReason).toBe('refusal');
  });

  it('replays thinking blocks with their signatures on the next call', async () => {
    const { bodies, send } = transport([
      () =>
        message(
          [
            { type: 'thinking', thinking: 'plan', signature: 'sig-1' },
            { type: 'redacted_thinking', data: 'opaque' },
            { type: 'tool_use', id: 'tu_1', name: 'quote', input: {}, caller: { type: 'direct' } },
          ],
          'tool_use',
        ),
      () => message([{ type: 'text', text: 'done' }], 'end_turn'),
    ]);
    const llm = new ClaudeLLM({ apiKey: KEY, fetch: send });
    await llm.complete(request);
    await llm.complete({
      ...request,
      messages: [
        ...request.messages,
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'quote', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', toolUseId: 'tu_1', content: '1658', isError: false }] },
      ],
    });
    const sent = bodies[1]?.messages as { role: string; content: unknown[] }[];
    expect(sent[1]?.content).toEqual([
      { type: 'thinking', thinking: 'plan', signature: 'sig-1' },
      { type: 'redacted_thinking', data: 'opaque' },
      { type: 'tool_use', id: 'tu_1', name: 'quote', input: {} },
    ]);
    expect(sent[2]?.content).toEqual([{ type: 'tool_result', tool_use_id: 'tu_1', content: '1658', is_error: false }]);
  });
});

describe('ClaudeLLM backoff', () => {
  it('retries one 529 and then succeeds', async () => {
    const { bodies, send } = transport([() => failure(529), () => message([{ type: 'text', text: 'ok' }], 'end_turn')]);
    const reply = await new ClaudeLLM({ apiKey: KEY, fetch: send }).complete(request);
    expect(reply.stopReason).toBe('end_turn');
    expect(bodies).toHaveLength(2);
  });

  it('throws an LlmError without the key when every attempt fails', async () => {
    const { bodies, send } = transport([() => failure(500)]);
    const error = await new ClaudeLLM({ apiKey: KEY, fetch: send }).complete(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).message).not.toContain(KEY);
    expect((error as LlmError).message).toContain('500');
    expect(bodies).toHaveLength(4);
  });
});
