import { BudgetPolicy, ClaudeLLM, createAgent, createEventChannel, ScriptedPlanLLM } from '@hackatwin/agent-kit';
import { type AgentEvent, type LLM, Ports } from '@hackatwin/core';
import { BANNER, simulatedOf } from '../labels.ts';
import { composeRoot, type Root, type RootOptions } from '../root.ts';
import { Tokens } from '../tokens.ts';
import { formatEvent } from './format.ts';
import { PROMPT, SYSTEM } from './prompt.ts';
import { paymentPlan } from './scripted-plan.ts';
import { createPaymentTools, type PaymentToolsOptions } from './tools.ts';

export interface Demo2RunOptions {
  readonly llm: 'claude' | 'scripted';
  readonly compose?: (options: RootOptions) => Promise<Root>;
  readonly tools?: Pick<PaymentToolsOptions, 'sleep' | 'pollMs' | 'maxPolls'>;
}

export interface Demo2Run {
  readonly events: AsyncIterable<AgentEvent>;
}

// One Demo 2 payer run: the events are stamped from the profile and end after run.finished.
export async function startDemo2Run({ llm, compose = composeRoot, tools = {} }: Demo2RunOptions): Promise<Demo2Run> {
  const { container, profile } = await compose({ llm });
  const simulated = simulatedOf(profile);
  const channel = createEventChannel(simulated === undefined ? {} : { simulated });
  const hub = container.resolve(Tokens.Hub);
  const model: LLM =
    llm === 'scripted'
      ? new ScriptedPlanLLM(paymentPlan)
      : new ClaudeLLM({
          apiKey: profile.env.ANTHROPIC_API_KEY,
          ...(profile.llm?.provider === 'claude' && { model: profile.llm.model }),
        });
  const run = createAgent({
    llm: model,
    llmName: llm,
    tools: createPaymentTools({
      ...tools,
      messenger: container.resolve(Ports.CrossChainMessenger),
      world: container.resolve(Tokens.World),
      amount: profile.budget.perPayment,
      chainTime: async () => (await hub.public.getBlock()).timestamp,
    }),
    policy: new BudgetPolicy(profile.budget, channel.emit),
    channel,
    system: SYSTEM,
    prompt: PROMPT,
    agent: 'payer',
    profile: profile.name,
  });
  const events = (async function* () {
    try {
      yield* run;
    } finally {
      await container.dispose();
    }
  })();
  return { events };
}

// Prints the banner first, then one line per event; the exit code is 0 only when the run finished.
export async function runDemo2(options: Demo2RunOptions, print: (line: string) => void): Promise<number> {
  print(BANNER);
  const run = await startDemo2Run(options);
  let reason = 'error';
  for await (const event of run.events) {
    print(formatEvent(event));
    if (event.type === 'run.finished') reason = event.reason;
  }
  return reason === 'done' ? 0 : 1;
}
