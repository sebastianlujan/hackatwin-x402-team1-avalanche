import { decodeFrame, type Envelope } from './envelope.ts';

export type Llm = 'claude' | 'scripted';

export const CLAUDE_DISABLED_REASON = 'the server has no ANTHROPIC_API_KEY';

export type StartResult =
  | { readonly type: 'started'; readonly id: string }
  | { readonly type: 'active'; readonly id: string }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'ignored' };

export interface Starter {
  press(llm: Llm): Promise<StartResult>;
  release(): void;
}

// Only a press may pay: presses while a POST is pending or a run is active are ignored.
export function createStarter(post: (llm: Llm) => Promise<Response>): Starter {
  let busy = false;
  return {
    async press(llm) {
      if (busy) return { type: 'ignored' };
      busy = true;
      try {
        const response = await post(llm);
        const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
        if (response.status === 202 && body.id !== undefined) return { type: 'started', id: body.id };
        if (response.status === 409 && body.id !== undefined) return { type: 'active', id: body.id };
        busy = false;
        return { type: 'error', message: body.error ?? `the server answered ${response.status}` };
      } catch {
        busy = false;
        return { type: 'error', message: 'the server is unreachable' };
      }
    },
    release() {
      busy = false;
    },
  };
}

export interface StreamState {
  readonly status: 'idle' | 'live' | 'reconnecting' | 'finished' | 'error';
  readonly frames: readonly Envelope[];
  readonly error?: string;
}

export type StreamAction =
  | { readonly type: 'reset' }
  | { readonly type: 'frame'; readonly data: string }
  | { readonly type: 'drop'; readonly closed: boolean };

export const initialStream: StreamState = { status: 'idle', frames: [] };

export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  if (action.type === 'reset') return initialStream;
  if (state.status === 'finished' || state.status === 'error') return state;
  if (action.type === 'drop') {
    return action.closed
      ? { ...state, status: 'error', error: 'The stream is unavailable' }
      : { ...state, status: 'reconnecting' };
  }
  let frame: Envelope;
  try {
    frame = decodeFrame(action.data);
  } catch (error) {
    return { ...state, status: 'error', error: error instanceof Error ? error.message : 'Unreadable frame' };
  }
  const last = state.frames.at(-1)?.seq ?? 0;
  if (frame.seq <= last) return { ...state, status: 'live' };
  return { status: frame.event.type === 'run.finished' ? 'finished' : 'live', frames: [...state.frames, frame] };
}

// The Scripted badge comes from run.started, so it stays for the whole run.
export function modeBadge(frames: readonly Envelope[]): string | undefined {
  const started = frames.find((f) => f.event.type === 'run.started')?.event;
  return started?.type === 'run.started' && started.llm === 'scripted' ? 'Scripted' : undefined;
}
