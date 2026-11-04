import type { Demo1Copy } from '../../content/copy.ts';
import type { BalanceView, PartyBalance } from '../../lib/demo-1-state.ts';
import styles from './BalancesPanel.module.css';

export interface BalancesPanelProps {
  readonly copy: Demo1Copy['balances'];
  readonly balances?: BalanceView | undefined;
}

export function BalancesPanel({ copy, balances }: BalancesPanelProps) {
  if (balances === undefined) return <p className={styles.empty}>{copy.empty}</p>;
  const parties: readonly (readonly [string, PartyBalance])[] = [
    [copy.agent, balances.agent],
    [copy.seller, balances.seller],
  ];
  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{copy.before}</th>
            <th scope="col">{copy.after}</th>
            <th scope="col">{copy.change}</th>
          </tr>
        </thead>
        <tbody>
          {parties.map(([label, party]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{party.before}</td>
              <td>{party.after ?? copy.pending}</td>
              <td>{party.change ?? copy.pending}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {balances.moved === undefined ? null : (
        <p className={styles.moved}>
          {copy.moved} <code>{balances.moved}</code>
        </p>
      )}
    </div>
  );
}
