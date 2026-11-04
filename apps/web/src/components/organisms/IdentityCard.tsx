import { Badge } from '@hackatwin/ui';
import type { IdentityCopy } from '../../content/copy.ts';
import type { IdentityRowView, IdentityView } from '../../lib/identity-view.ts';
import styles from './IdentityCard.module.css';

export interface IdentityCardProps {
  readonly copy: IdentityCopy;
  readonly view: IdentityView;
}

function Reputation({ copy, row, offline }: { copy: IdentityCopy; row: IdentityRowView; offline: boolean }) {
  const text = copy.reputation;
  if (offline || row.reputation === undefined) return <>{text.unavailable}</>;
  if (row.reputation.count === '0') return <>{text.none}</>;
  return (
    <>
      {row.reputation.count} {text.feedback}, {text.score} {row.reputation.score}
    </>
  );
}

export function IdentityCard({ copy, view }: IdentityCardProps) {
  return (
    <div className={styles.card}>
      {view.offline ? (
        <p role="status" className={styles.offline}>
          <Badge tone="accent">{copy.offline}</Badge> {copy.offlineNote}
        </p>
      ) : null}
      {view.rows.map((row) => (
        <section key={row.role} className={styles.row} aria-label={copy.roles[row.role]}>
          <h2 className={styles.role}>{copy.roles[row.role]}</h2>
          <dl className={styles.fields}>
            <dt>{copy.fields.agentId}</dt>
            <dd>{row.agentId ?? copy.notSet}</dd>
            <dt>{copy.fields.owner}</dt>
            <dd className={styles.mono}>{row.owner ?? copy.notSet}</dd>
            <dt>{copy.fields.reputation}</dt>
            <dd>
              <Reputation copy={copy} row={row} offline={view.offline} />
            </dd>
          </dl>
        </section>
      ))}
    </div>
  );
}
