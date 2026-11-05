import type { AgentEvent, AgentPolicy, ToolSpec } from '@hackatwin/core';
import { z } from 'zod';

export type Emit = (event: AgentEvent) => void;

export interface Tool<I> {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType<I>;
  run(input: I, context: { readonly emit: Emit; readonly policy: AgentPolicy }): Promise<string>;
}

// Erases the input type so one agent can hold tools of different inputs.
export const defineTool = <I>(tool: Tool<I>): Tool<never> => tool as unknown as Tool<never>;

export function toToolSpec(tool: Tool<never>): ToolSpec {
  const { $schema: _dropped, ...inputSchema } = z.toJSONSchema(tool.input as z.ZodType) as Record<string, unknown>;
  return { name: tool.name, description: tool.description, inputSchema };
}
