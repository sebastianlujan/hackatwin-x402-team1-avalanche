import type { LlmMessage } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { LlmError } from '../../src/llm/errors.ts';
import { ScriptedPlanLLM, toolOutcomes } from '../../src/llm/scripted-plan-llm.ts';

const user = (text: string): LlmMessage => ({ role: 'user', content: [{ type: 'text', text }] });

describe('ScriptedPlanLLM', () => {
  it('walks the plan, labels the reasoning and assigns tool ids', async () => {
    const llm = new ScriptedPlanLLM([
      () => ({ reasoning: 'get a quote', calls: [{ name: 'quote', input: {} }] }),
      () => ({ reasoning: 'Scripted plan: finished', text: 'done' }),
    ]);
    expect(await llm.complete({ messages: [user('go')] })).toEqual({
      content: [{ type: 'tool_use', id: 'scripted-0-0', name: 'quote', input: {} }],
      reasoning: 'Scripted plan: get a quote',
      stopReason: 'tool_use',
    });
    expect(await llm.complete({ messages: [user('go')] })).toEqual({
      content: [{ type: 'text', text: 'done' }],
      reasoning: 'Scripted plan: finished',
      stopReason: 'end_turn',
    });
  });

  it('lets a step react to the conversation so far', async () => {
    const llm = new ScriptedPlanLLM([
      (messages) => ({
        reasoning: 'branch',
        text: toolOutcomes(messages).some((o) => o.isError) ? 'failed' : 'fine',
      }),
    ]);
    const messages: LlmMessage[] = [
      user('go'),
      { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'buy', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 'a', content: 'nope', isError: true }] },
    ];
    expect((await llm.complete({ messages })).content).toEqual([{ type: 'text', text: 'failed' }]);
  });

  it('fails with an LlmError when the plan runs out', async () => {
    await expect(new ScriptedPlanLLM([]).complete({ messages: [] })).rejects.toBeInstanceOf(LlmError);
  });
});

describe('toolOutcomes', () => {
  it('pairs results with the tool names', () => {
    const messages: LlmMessage[] = [
      { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'buy', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 'a', content: '200', isError: false }] },
    ];
    expect(toolOutcomes(messages)).toEqual([{ name: 'buy', content: '200', isError: false }]);
  });
});
