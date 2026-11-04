import { Badge, Cursor } from '@hackatwin/ui';
import type { ReactNode } from 'react';
import type { TalkScreenCopy } from '../../content/copy.ts';
import styles from './TalkScreen.module.css';

export interface TalkScreenProps {
  readonly brand: string;
  readonly copy: TalkScreenCopy;
  readonly badge?: string | undefined;
  readonly children?: ReactNode;
}

// A static talk screen: text only, so it renders with no service running.
export function TalkScreen({ brand, copy, badge, children }: TalkScreenProps) {
  return (
    <main className={styles.screen}>
      <Cursor text={brand} />
      <h1>{copy.title}</h1>
      {badge === undefined ? null : <Badge tone="accent">{badge}</Badge>}
      <p className={styles.lead}>{copy.lead}</p>
      <dl className={styles.items}>
        {copy.items.map((item) => (
          <div key={item.term} className={styles.item}>
            <dt>{item.term}</dt>
            <dd>{item.text}</dd>
          </div>
        ))}
      </dl>
      {children}
    </main>
  );
}
