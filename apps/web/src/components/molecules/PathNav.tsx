import Link from 'next/link';
import type { PathCopy } from '../../content/copy.ts';
import styles from './PathNav.module.css';

export interface PathNavProps {
  readonly copy: PathCopy['nav'];
  readonly index: number;
  readonly total: number;
  readonly previous?: string | undefined;
  readonly next?: string | undefined;
}

export function PathNav({ copy, index, total, previous, next }: PathNavProps) {
  return (
    <nav className={styles.nav} aria-label={copy.label}>
      {previous === undefined ? (
        <span />
      ) : (
        <Link href={previous} rel="prev">
          {copy.previous}
        </Link>
      )}
      <span className={styles.position}>
        {index} / {total}
      </span>
      {next === undefined ? (
        <span />
      ) : (
        <Link href={next} rel="next">
          {copy.next}
        </Link>
      )}
    </nav>
  );
}
