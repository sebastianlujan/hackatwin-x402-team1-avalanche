import { Badge, TxLink } from '@hackatwin/ui';
import type { Demo1Copy } from '../../content/copy.ts';
import type { ForkHash } from '../../lib/demo-1-state.ts';
import styles from './ForkHashes.module.css';

export interface ForkHashesProps {
  readonly copy: Demo1Copy['fork'];
  readonly hashes: readonly ForkHash[];
}

// Fork hashes are plain text: the local fork has no explorer, so TxLink gets no URL.
export function ForkHashes({ copy, hashes }: ForkHashesProps) {
  if (hashes.length === 0) return <p className={styles.empty}>{copy.empty}</p>;
  return (
    <ul className={styles.list} aria-label={copy.title}>
      {hashes.map((item) => (
        <li key={item.seq} className={styles.item}>
          <Badge>{copy.label}</Badge>
          <span className={styles.kind}>{copy.kinds[item.kind]}</span>
          <TxLink hash={item.hash} />
        </li>
      ))}
    </ul>
  );
}
