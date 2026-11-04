import type { LandingCopy } from '../../content/copy.ts';
import styles from './Faq.module.css';

// Native details and summary: no hooks, works without script.
export function Faq({ copy }: { readonly copy: LandingCopy['faq'] }) {
  return (
    <section className={styles.faq} aria-label={copy.title}>
      <h2 className={styles.title}>{copy.title}</h2>
      {copy.items.map((item) => (
        <details key={item.question} className={styles.item}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
