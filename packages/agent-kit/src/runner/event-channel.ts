import type { AgentEvent } from '@hackatwin/core';
import type { Emit } from './tool.ts';

export interface EventChannel {
  readonly emit: Emit;
  // Yields every event emitted while the work runs, then the rest, and returns the work's result.
  until<T>(work: Promise<T>): AsyncGenerator<AgentEvent, T>;
}

export function createEventChannel(): EventChannel {
  const queue: AgentEvent[] = [];
  let wake: (() => void) | undefined;
  const poke = (): void => {
    const waiting = wake;
    wake = undefined;
    waiting?.();
  };
  return {
    emit(event) {
      queue.push(event);
      poke();
    },
    async *until<T>(work: Promise<T>): AsyncGenerator<AgentEvent, T> {
      const outcome: { result?: T; error?: unknown; failed: boolean; done: boolean } = { failed: false, done: false };
      work.then(
        (result) => {
          Object.assign(outcome, { result, done: true });
          poke();
        },
        (error: unknown) => {
          Object.assign(outcome, { error, failed: true, done: true });
          poke();
        },
      );
      for (;;) {
        for (let event = queue.shift(); event !== undefined; event = queue.shift()) yield event;
        if (outcome.done) break;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      if (outcome.failed) throw outcome.error;
      return outcome.result as T;
    },
  };
}
