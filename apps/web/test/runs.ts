import type { AgentEvent } from '@hackatwin/core';
import type { StartedRun } from '../src/server/run-store.ts';

const balances = { agent: 10n, seller: 0n };

// A run that emits the given events, then ends.
export const finite = (events: readonly AgentEvent[]): StartedRun => ({
  llm: 'scripted',
  before: balances,
  events: (async function* () {
    yield* events;
  })(),
  after: async () => ({ agent: 7n, seller: 3n }),
});

// A run that never emits and never ends.
export const hanging = (): StartedRun => ({
  llm: 'scripted',
  before: balances,
  events: (async function* () {
    await new Promise(() => {});
  })(),
  after: async () => balances,
});

export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));
