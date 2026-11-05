import type { Demo1Copy } from '../../content/copy.ts';
import type { Strip } from '../../lib/demo-1-state.ts';
import styles from './PaymentStrip.module.css';

const STEPS = ['required', 'paid', 'received'] as const;

export interface PaymentStripProps {
  readonly copy: Demo1Copy['strip'];
  readonly strip: Strip;
}

export function PaymentStrip({ copy, strip }: PaymentStripProps) {
  return (
    <ol className={styles.strip} aria-label={copy.label}>
      {STEPS.map((step) => (
        <li key={step} className={styles.step} data-state={strip[step]}>
          <span className={styles.name}>{copy.steps[step]}</span>
          <span className={styles.state}>{copy.state[strip[step]]}</span>
        </li>
      ))}
    </ol>
  );
}
