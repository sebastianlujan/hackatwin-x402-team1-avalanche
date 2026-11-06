import { createEventChannel, defineTool, ScriptedPlanLLM } from '@hackatwin/agent-kit';
import { ConfigError } from '@hackatwin/config';
import { type AgentEvent, createContainer } from '@hackatwin/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { startDemo1Run } from '../../buyer-agent/entry.ts';
import { PreflightError } from '../../buyer-agent/preflight.ts';
import { runBuyer } from '../../buyer-agent/run.ts';
import { buyerPlan } from '../../buyer-agent/scripted-plan.ts';
import type { RootOptions } from '../../root.ts';
import { Tokens } from '../../tokens.ts';

const rpc = 'https://rpc.example.org';
const env = {
  AGENT_KEYSTORE: 'agent',
  AGENT_KEYSTORE_PASSWORD_FILE: '/run/secrets/agent',
  SELLER_KEYSTORE: 'seller',
  SELLER_KEYSTORE_PASSWORD_FILE: '/run/secrets/seller',
  FACILITATOR_KEYSTORE: 'facilitator',
  FACILITATOR_KEYSTORE_PASSWORD_FILE: '/run/secrets/facilitator',
  CCHAIN_FORK_RPC_URL: 'http://127.0.0.1:8545',
  CCHAIN_RPC_URL: rpc,
  ARBITRUM_RPC_URL: rpc,
  BASE_RPC_URL: rpc,
};

const tool = (name: string, emit?: AgentEvent) =>
  defineTool({
    name,
    description: name,
    input: z.object({}),
    run: async (_input, context) => {
      if (emit) context.emit(emit);
      return 'ok';
    },
  });
const received: AgentEvent = { version: 1, type: 'resource.received', at: 1, resource: 'r', status: 200 };

// A root whose buyer tools emit through the Events token, as the real module does.
function fakeRoot(
  reads: bigint[][] = [
    [10n, 0n],
    [7n, 3n],
  ],
) {
  const container = createContainer();
  const read = vi.fn(async () => {
    const [agent = 0n, seller = 0n] = reads.shift() ?? [];
    return { agent, seller };
  });
  const cheats = { forkBlock: vi.fn(async () => 9n), syncClock: vi.fn(async () => undefined) };
  container.register(Tokens.Config, () => ({ name: 'cchain-fork', forkBlock: 9n, env: {} }) as never);
  container.register(Tokens.Accounts, () => ({ agent: { address: '0x1' }, seller: { address: '0x2' } }) as never);
  container.register(Tokens.State, () => ({ dir: '/mem', read: () => undefined, write: vi.fn() }));
  container.register(Tokens.Balances, () => ({ read }));
  container.register(Tokens.Buyer, (resolver) => {
    resolver.resolve(Tokens.Events);
    return { tools: [tool('quote'), tool('buy', received), tool('rate_seller')], policy: {} as never };
  });
  const fork = { refusal: undefined, chainClient: () => ({}), cheats: () => cheats };
  const compose = vi.fn(async (_options: RootOptions) => ({
    container,
    profile: container.resolve(Tokens.Config),
    fork,
  }));
  return { container, read, cheats, compose: compose as never };
}

const ok = { registered: async () => true, funded: async () => true, serviceUp: async () => true };
const collect = async (events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> => {
  const out: AgentEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('startDemo1Run', () => {
  it('streams the same events as the CLI run and reads balances around it', async () => {
    const { compose, container } = fakeRoot();
    const run = await startDemo1Run({ llm: 'scripted', preflight: ok, compose });
    const events = await collect(run.events);
    const direct = fakeRoot();
    const directChannel = createEventChannel();
    direct.container.register(Tokens.Events, () => directChannel.emit);
    const expected = await collect(
      runBuyer({
        container: direct.container,
        channel: directChannel,
        llm: new ScriptedPlanLLM(buyerPlan),
        llmName: 'scripted',
      }),
    );
    expect(events.map((e) => e.type)).toEqual(expected.map((e) => e.type));
    expect(events.at(-1)).toMatchObject({ type: 'run.finished', reason: 'done' });
    expect(events[0]).toMatchObject({ type: 'run.started', llm: 'scripted' });
    expect(run).toMatchObject({ llm: 'scripted', before: { agent: 10n, seller: 0n } });
    expect(await run.after()).toEqual({ agent: 7n, seller: 3n });
    expect(() => container.resolve(Tokens.Config)).toThrow('disposed');
  });

  it('raises PreflightError before any clock or balance read and disposes the root', async () => {
    const { compose, container, cheats, read } = fakeRoot();
    const refused = startDemo1Run({ llm: 'scripted', preflight: { ...ok, refusal: 'remote RPC' }, compose });
    await expect(refused).rejects.toThrow(PreflightError);
    const down = startDemo1Run({
      llm: 'scripted',
      preflight: { ...ok, serviceUp: async () => false },
      compose: fakeRoot().compose,
    });
    await expect(down).rejects.toThrow('pnpm demo1:facilitator');
    expect(cheats.syncClock).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(() => container.resolve(Tokens.Config)).toThrow('disposed');
  });
});

describe('real composition', () => {
  const stub = (extra: Record<string, string> = {}): void => {
    for (const [key, value] of Object.entries({ ...env, ...extra })) vi.stubEnv(key, value);
  };

  it('checks the Claude key before any chain call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    stub();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const error = await startDemo1Run({ llm: 'claude', stateDir: '/abs/.demo1' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).issues.map((i) => i.variable)).toContain('ANTHROPIC_API_KEY');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails a relative KEYSTORE_DIR naming the variable', async () => {
    stub({ KEYSTORE_DIR: '.demo1' });
    await expect(startDemo1Run({ llm: 'scripted' })).rejects.toThrow(/KEYSTORE_DIR/);
  });

  it('fails with no KEYSTORE_DIR and no stateDir naming the variable', async () => {
    stub();
    vi.stubEnv('KEYSTORE_DIR', '');
    await expect(startDemo1Run({ llm: 'scripted' })).rejects.toThrow(/KEYSTORE_DIR/);
  });
});
