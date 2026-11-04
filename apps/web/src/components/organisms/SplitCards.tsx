import type { LandingCopy } from '../../content/copy.ts';
import styles from './SplitCards.module.css';

// The marks are plain text until the logos are approved (O4).
export function SplitCards({ copy }: { readonly copy: LandingCopy['cards'] }) {
  return (
    <section className={styles.cards} aria-label={copy.title}>
      {copy.items.map((item) => (
        <article key={item.mark} className={styles.card}>
          <h2 className={styles.mark}>{item.mark}</h2>
          <p>{item.text}</p>
        </article>
      ))}
    </section>
  );
}
