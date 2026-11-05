import { Badge } from '@hackatwin/ui';
import type { Demo1Copy } from '../../content/copy.ts';
import type { QuoteView } from '../../lib/demo-1-state.ts';
import styles from './QuotePanel.module.css';

export interface QuotePanelProps {
  readonly copy: Demo1Copy['quote'];
  readonly quote?: QuoteView | undefined;
}

export function QuotePanel({ copy, quote }: QuotePanelProps) {
  if (quote === undefined) return <p className={styles.empty}>{copy.empty}</p>;
  const rows = [
    [copy.source, { text: quote.source, full: quote.source }],
    [copy.rate, quote.rate],
    [copy.price, quote.price],
    [copy.amount, quote.amount],
    [copy.validUntil, { text: quote.validUntil, full: quote.validUntil }],
  ] as const;
  return (
    <div className={styles.panel}>
      <dl className={styles.rows}>
        {rows.map(([label, shown]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd title={shown.full}>{shown.text}</dd>
          </div>
        ))}
      </dl>
      {quote.guarded ? <Badge tone="accent">{copy.guard}</Badge> : null}
      <p className={styles.note}>{copy.disclaimer}</p>
    </div>
  );
}
