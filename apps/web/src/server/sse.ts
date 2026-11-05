import 'server-only';
import { encodeFrame } from '../lib/envelope.ts';
import type { RunStore } from './run-store.ts';

export const HEARTBEAT_MS = 15_000;

export interface EventsRequest {
  readonly store: RunStore;
  readonly id: string;
  readonly lastEventId: string | null;
  readonly signal: AbortSignal;
  readonly heartbeatMs?: number;
}

const HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};

// A disconnect only unsubscribes; it never cancels the run or its payment.
export function eventsResponse({
  store,
  id,
  lastEventId,
  signal,
  heartbeatMs = HEARTBEAT_MS,
}: EventsRequest): Response {
  const parsed = Number(lastEventId);
  const afterSeq = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  const encoder = new TextEncoder();
  let stop = (): void => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string): void => controller.enqueue(encoder.encode(text));
      let off: (() => void) | undefined;
      let timer: ReturnType<typeof setInterval> | undefined;
      let closed = false;
      stop = (): void => {
        if (closed) return;
        closed = true;
        off?.();
        clearInterval(timer);
        controller.close();
      };
      send('retry: 1000\n\n');
      off = store.subscribe(id, afterSeq, (frame) => {
        send(`id: ${frame.seq}\ndata: ${encodeFrame(frame)}\n\n`);
        if (frame.event.type === 'run.finished') queueMicrotask(stop);
      });
      timer = setInterval(() => send(': ping\n\n'), heartbeatMs);
      signal.addEventListener('abort', stop, { once: true });
    },
    cancel: () => stop(),
  });
  return new Response(body, { headers: HEADERS });
}
