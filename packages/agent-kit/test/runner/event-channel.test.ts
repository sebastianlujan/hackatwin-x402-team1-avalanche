import type { AgentEvent } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { createEventChannel } from '../../src/runner/event-channel.ts';

const event = (text: string): AgentEvent => ({ version: 1, type: 'llm.reasoning', at: 1, text });
const texts = (events: AgentEvent[]): string[] => events.map((e) => (e.type === 'llm.reasoning' ? e.text : e.type));

async function drain<T>(generator: AsyncGenerator<AgentEvent, T>): Promise<{ events: AgentEvent[]; result: T }> {
  const events: AgentEvent[] = [];
  for (;;) {
    const next = await generator.next();
    if (next.done === true) return { events, result: next.value };
    events.push(next.value);
  }
}

describe('EventChannel.until', () => {
  it('yields events emitted while the work runs and returns its result', async () => {
    const channel = createEventChannel();
    const work = (async () => {
      channel.emit(event('a'));
      await new Promise((resolve) => setTimeout(resolve, 5));
      channel.emit(event('b'));
      return 42;
    })();
    const { events, result } = await drain(channel.until(work));
    expect(texts(events)).toEqual(['a', 'b']);
    expect(result).toBe(42);
  });

  it('yields events queued before the call', async () => {
    const channel = createEventChannel();
    channel.emit(event('early'));
    const { events } = await drain(channel.until(Promise.resolve()));
    expect(texts(events)).toEqual(['early']);
  });

  it('streams an event before the work finishes', async () => {
    const channel = createEventChannel();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const generator = channel.until(gate.then(() => 'done'));
    channel.emit(event('live'));
    expect(texts([(await generator.next()).value as AgentEvent])).toEqual(['live']);
    release();
    expect(await generator.next()).toEqual({ done: true, value: 'done' });
  });

  it('delivers the events and then rethrows when the work fails', async () => {
    const channel = createEventChannel();
    const work = (async () => {
      channel.emit(event('before'));
      throw new Error('boom');
    })();
    const generator = channel.until(work);
    expect(texts([(await generator.next()).value as AgentEvent])).toEqual(['before']);
    await expect(generator.next()).rejects.toThrow('boom');
  });
});

describe('EventChannel simulated stamping', () => {
  it('stamps an event emitted without the field when the channel is simulated', async () => {
    const channel = createEventChannel({ simulated: 'local-crosschain' });
    channel.emit(event('a'));
    channel.emit({ version: 1, type: 'run.finished', at: 2, reason: 'done' });
    const { events } = await drain(channel.until(Promise.resolve()));
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.simulated)).toEqual(['local-crosschain', 'local-crosschain']);
  });

  it('adds no marker on a channel without the option', async () => {
    const channel = createEventChannel();
    channel.emit(event('a'));
    const { events } = await drain(channel.until(Promise.resolve()));
    expect(events).toHaveLength(1);
    expect('simulated' in (events[0] as AgentEvent)).toBe(false);
  });
});
