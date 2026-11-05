'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { Demo1Screen } from '../components/templates/Demo1Screen.tsx';
import type { Demo1Copy } from '../content/copy.ts';
import { balanceView, deriveDemo1 } from '../lib/demo-1-state.ts';
import { parseRunRecord, type RunRecord } from '../lib/run-record.ts';
import { createStarter, initialStream, type Llm, modeBadge, streamReducer } from '../lib/starter.ts';

export interface Demo1RunProps {
  readonly copy: Demo1Copy;
  readonly initialRunId?: string | undefined;
  readonly claudeAvailable: boolean;
}

export function Demo1Run({ copy, initialRunId, claudeAvailable }: Demo1RunProps) {
  const [runId, setRunId] = useState(initialRunId);
  const [stream, dispatch] = useReducer(streamReducer, initialStream);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string>();
  const [record, setRecord] = useState<RunRecord>({});
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

  // Balances live on the run record: before is there from the start, after once the run finished.
  const finished = stream.status === 'finished';
  useEffect(() => {
    if (runId === undefined) return;
    let current = true;
    fetch(`/api/runs/${runId}`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body: unknown) => current && setRecord(parseRunRecord(body)))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [runId, finished]);

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
    <Demo1Screen
      copy={copy}
      view={deriveDemo1(stream.frames)}
      balances={balanceView(record.before, record.after)}
      stream={stream}
      scripted={modeBadge(stream.frames) !== undefined}
      claudeAvailable={claudeAvailable}
      busy={posting || streaming}
      postError={postError}
      onStart={start}
    />
  );
}
