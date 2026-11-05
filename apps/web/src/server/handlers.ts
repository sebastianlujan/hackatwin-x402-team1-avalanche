import 'server-only';
import { redact } from './redact.ts';
import type { RunStore, RunView, StartedRun } from './run-store.ts';
import { eventsResponse } from './sse.ts';

export type Llm = 'claude' | 'scripted';
export interface StartDeps {
  readonly store: RunStore;
  readonly open: (llm: Llm) => Promise<StartedRun>;
  readonly hasAnthropicKey: () => boolean;
}
export interface ReadDeps {
  readonly store: RunStore;
}
export interface IdContext {
  readonly params: Promise<{ readonly id: string }>;
}

const json = (body: unknown, status: number): Response => Response.json(body, { status });

// A browser sends Origin on cross-site posts; curl sends none, and both must stay loopback-local.
const sameOrigin = (request: Request): boolean => {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  const url = new URL(request.url);
  return origin === `${url.protocol}//${request.headers.get('host') ?? url.host}`;
};
const isJson = (request: Request): boolean =>
  (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() === 'application/json';

export function createStartHandler({ store, open, hasAnthropicKey }: StartDeps) {
  return async (request: Request): Promise<Response> => {
    if (!sameOrigin(request)) return json({ error: 'cross-origin requests are not allowed' }, 403);
    if (!isJson(request)) return json({ error: 'content-type must be application/json' }, 415);
    const body: unknown = await request.json().catch(() => undefined);
    const llm = (body as { llm?: unknown } | undefined)?.llm;
    if (llm !== 'claude' && llm !== 'scripted') return json({ error: 'llm must be "claude" or "scripted"' }, 400);
    if (llm === 'claude' && !hasAnthropicKey()) return json({ error: 'the server has no ANTHROPIC_API_KEY' }, 422);
    try {
      const started = await store.start(() => open(llm));
      if ('conflict' in started) return json({ id: started.conflict }, 409);
      return json({ id: started.id }, 202);
    } catch (error) {
      return json({ error: redact(error instanceof Error ? error.message : String(error)) }, 503);
    }
  };
}

const decimals = (view: RunView) => ({
  id: view.id,
  status: view.status,
  llm: view.llm ?? null,
  before: view.before ? { agent: view.before.agent.toString(), seller: view.before.seller.toString() } : null,
  after: view.after ? { agent: view.after.agent.toString(), seller: view.after.seller.toString() } : null,
});

export function createRunHandler({ store }: ReadDeps) {
  return async (_request: Request, { params }: IdContext): Promise<Response> => {
    const view = store.get((await params).id);
    return view === undefined ? json({ error: 'unknown run' }, 404) : json(decimals(view), 200);
  };
}

export function createEventsHandler({ store }: ReadDeps) {
  return async (request: Request, { params }: IdContext): Promise<Response> => {
    const id = (await params).id;
    if (store.get(id) === undefined) return json({ error: 'unknown run' }, 404);
    return eventsResponse({ store, id, lastEventId: request.headers.get('last-event-id'), signal: request.signal });
  };
}
