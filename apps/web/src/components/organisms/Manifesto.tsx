import type { LandingCopy } from '../../content/copy.ts';
import styles from './Manifesto.module.css';

export function Manifesto({ copy }: { readonly copy: LandingCopy['manifesto'] }) {
  return (
    <section className={styles.manifesto} aria-label={copy.title}>
      <h2 className={styles.title}>{copy.title}</h2>
      {copy.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}
