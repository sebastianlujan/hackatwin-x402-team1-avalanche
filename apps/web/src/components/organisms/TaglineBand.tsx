import type { LandingCopy } from '../../content/copy.ts';
import styles from './TaglineBand.module.css';

export function TaglineBand({ copy }: { readonly copy: LandingCopy['tagline'] }) {
  return (
    <aside className={styles.band}>
      <p>{copy.text}</p>
    </aside>
  );
}
