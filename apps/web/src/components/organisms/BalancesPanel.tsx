import type { Demo1Copy } from '../../content/copy.ts';
import type { BalanceView, PartyBalance } from '../../lib/demo-1-state.ts';
import type { Shown } from '../../lib/format.ts';
import styles from './BalancesPanel.module.css';

export interface BalancesPanelProps {
  readonly copy: Demo1Copy['balances'];
  readonly balances?: BalanceView | undefined;
}

function Cell({ shown, pending }: { readonly shown: Shown | undefined; readonly pending?: string }) {
  return shown === undefined ? <td>{pending}</td> : <td title={shown.full}>{shown.text}</td>;
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
              <Cell shown={party.before} />
              <Cell shown={party.after} pending={copy.pending} />
              <Cell shown={party.change} pending={copy.pending} />
            </tr>
          ))}
        </tbody>
      </table>
      {balances.moved === undefined ? null : (
        <p className={styles.moved}>
          {copy.moved} <code title={balances.moved.full}>{balances.moved.text}</code>
        </p>
      )}
    </div>
  );
}
