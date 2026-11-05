import { Badge } from '@hackatwin/ui';
import type { Demo1Copy } from '../../content/copy.ts';
import type { TimelineEntry } from '../../lib/demo-1-state.ts';
import styles from './Timeline.module.css';

export interface TimelineProps {
  readonly copy: Demo1Copy['timeline'];
  readonly entries: readonly TimelineEntry[];
}

export function Timeline({ copy, entries }: TimelineProps) {
  if (entries.length === 0) return <p className={styles.empty}>{copy.empty}</p>;
  return (
    <ol className={styles.list} aria-label={copy.title}>
      {entries.map((entry) => (
        <li key={entry.seq} className={styles.entry} data-failed={entry.failed}>
          <span className={styles.seq}>{entry.seq}</span>
          <span className={styles.kind}>{copy.kinds[entry.kind]}</span>
          <span className={styles.detail}>{entry.detail}</span>
          {entry.value === undefined ? null : <code className={styles.value}>{entry.value}</code>}
          {entry.failed ? <Badge tone="accent">{copy.error}</Badge> : null}
        </li>
      ))}
    </ol>
  );
}
