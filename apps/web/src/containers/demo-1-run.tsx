'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import type { Envelope } from '../lib/envelope.ts';
import {
  CLAUDE_DISABLED_REASON,
  createStarter,
  initialStream,
  type Llm,
  modeBadge,
  type StreamState,
  streamReducer,
} from '../lib/starter.ts';

export interface Demo1RunViewProps {
  readonly stream: StreamState;
  readonly claudeAvailable: boolean;
  readonly busy: boolean;
  readonly postError?: string | undefined;
  readonly onStart: (llm: Llm) => void;
}

const line = ({ seq, event }: Envelope): string => {
  switch (event.type) {
    case 'llm.reasoning':
      return `${seq} reasoning: ${event.text}`;
    case 'resource.received':
      return `${seq} resource.received ${event.status}`;
    case 'run.finished':
      return `${seq} run.finished ${event.reason}${event.message ? `: ${event.message}` : ''}`;
    default:
      return `${seq} ${event.type}`;
  }
};

export function Demo1RunView({ stream, claudeAvailable, busy, postError, onStart }: Demo1RunViewProps) {
  const badge = modeBadge(stream.frames);
  return (
    <main>
      <h1>Demo 1</h1>
      <div>
        <button type="button" disabled={busy || !claudeAvailable} onClick={() => onStart('claude')}>
          Run with Claude
        </button>
        <button type="button" disabled={busy} onClick={() => onStart('scripted')}>
          Run scripted
        </button>
        {claudeAvailable ? null : <p>Claude is off: {CLAUDE_DISABLED_REASON}</p>}
      </div>
      {badge === undefined ? null : <p>{badge}</p>}
      {postError === undefined ? null : <p role="alert">{postError}</p>}
      {stream.status === 'reconnecting' ? <p role="status">Reconnecting</p> : null}
      {stream.status === 'error' ? <p role="alert">{stream.error}</p> : null}
      <ol>
        {stream.frames.map((frame) => (
          <li key={frame.seq}>{line(frame)}</li>
        ))}
      </ol>
    </main>
  );
}

export interface Demo1RunProps {
  readonly initialRunId?: string | undefined;
  readonly claudeAvailable: boolean;
}

export function Demo1Run({ initialRunId, claudeAvailable }: Demo1RunProps) {
  const [runId, setRunId] = useState(initialRunId);
  const [stream, dispatch] = useReducer(streamReducer, initialStream);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string>();
  const source = useRef<EventSource>(undefined);
  const starter = useRef(
    createStarter((llm) =>
      fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ llm }),
      }),
    ),
  ).current;

  useEffect(() => {
    if (runId === undefined) return;
    dispatch({ type: 'reset' });
    // EventSource reconnects on its own and resends Last-Event-ID; the reducer drops repeated seq.
    const events = new EventSource(`/api/runs/${runId}/events`);
    source.current = events;
    events.onmessage = (message: MessageEvent<string>) => dispatch({ type: 'frame', data: message.data });
    events.onerror = () => dispatch({ type: 'drop', closed: events.readyState === EventSource.CLOSED });
    return () => events.close();
  }, [runId]);

  useEffect(() => {
    if (stream.status !== 'finished' && stream.status !== 'error') return;
    source.current?.close();
    starter.release();
  }, [stream.status, starter]);

  const start = (llm: Llm): void => {
    setPosting(true);
    setPostError(undefined);
    void starter.press(llm).then((result) => {
      setPosting(false);
      if (result.type === 'error') setPostError(result.message);
      else if (result.type !== 'ignored') setRunId(result.id);
    });
  };

  const streaming = stream.status === 'live' || stream.status === 'reconnecting';
  return (
    <Demo1RunView
      stream={stream}
      claudeAvailable={claudeAvailable}
      busy={posting || streaming}
      postError={postError}
      onStart={start}
    />
  );
}
