import { Badge, Button } from '@hackatwin/ui';
import type { Demo1Copy } from '../../content/copy.ts';
import type { Llm } from '../../lib/starter.ts';
import styles from './StartControl.module.css';

export interface StartControlProps {
  readonly copy: Demo1Copy['start'];
  readonly claudeAvailable: boolean;
  readonly busy: boolean;
  readonly scripted: boolean;
  readonly onStart: (llm: Llm) => void;
}

export function StartControl({ copy, claudeAvailable, busy, scripted, onStart }: StartControlProps) {
  return (
    <div className={styles.control}>
      <div className={styles.buttons}>
        <Button disabled={busy || !claudeAvailable} onClick={() => onStart('claude')}>
          {copy.claude}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onStart('scripted')}>
          {copy.scripted}
        </Button>
        {scripted ? <Badge tone="accent">{copy.badge}</Badge> : null}
      </div>
      {claudeAvailable ? null : (
        <p className={styles.reason}>
          {copy.claudeOff}: {copy.claudeReason}
        </p>
      )}
    </div>
  );
}
