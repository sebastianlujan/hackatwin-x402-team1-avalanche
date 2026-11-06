import { ScriptedPlanLLM } from '@hackatwin/agent-kit';
import type { LlmMessage } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { buyerPlan } from '../../buyer-agent/scripted-plan.ts';

const turn = (name: string, isError: boolean): LlmMessage[] => [
  { role: 'assistant', content: [{ type: 'tool_use', id: 'b', name, input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', toolUseId: 'b', content: 'x', isError }] },
];
const names = (reply: Awaited<ReturnType<ScriptedPlanLLM['complete']>>): string[] =>
  reply.content.flatMap((part) => (part.type === 'tool_use' ? [part.name] : []));

describe('buyerPlan', () => {
  it('quotes, buys, then rates after a purchase', async () => {
    const llm = new ScriptedPlanLLM(buyerPlan);
    expect(names(await llm.complete({ messages: [] }))).toEqual(['quote']);
    expect(names(await llm.complete({ messages: [] }))).toEqual(['buy']);
    expect(names(await llm.complete({ messages: turn('buy', false) }))).toEqual(['rate_seller']);
  });

  it('does not rate when the purchase failed', async () => {
    const llm = new ScriptedPlanLLM(buyerPlan);
    await llm.complete({ messages: [] });
    await llm.complete({ messages: [] });
    const reply = await llm.complete({ messages: turn('buy', true) });
    expect(names(reply)).toEqual([]);
    expect(reply.content).toEqual([{ type: 'text', text: 'The purchase failed and no rating was posted.' }]);
  });

  it('labels every reasoning line as scripted', async () => {
    const llm = new ScriptedPlanLLM(buyerPlan);
    expect((await llm.complete({ messages: [] })).reasoning).toMatch(/^Scripted plan: /);
  });
});
