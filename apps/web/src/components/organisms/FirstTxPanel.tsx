import { Button, TxLink } from '@hackatwin/ui';
import type { FirstTxCopy } from '../../content/copy.ts';
import type { FirstTxState } from '../../lib/first-tx-state.ts';
import styles from './FirstTxPanel.module.css';

export interface FirstTxPanelProps {
  readonly copy: FirstTxCopy;
  readonly state: FirstTxState;
  readonly hash?: string | undefined;
  readonly explorerUrl?: string | undefined;
  readonly preSentHash?: string | undefined;
  readonly preSentUrl?: string | undefined;
  readonly onConnect: () => void;
  readonly onSwitch: () => void;
  readonly onSend: () => void;
}

export function FirstTxPanel({
  copy,
  state,
  hash,
  explorerUrl,
  preSentHash,
  preSentUrl,
  onConnect,
  onSwitch,
  onSend,
}: FirstTxPanelProps) {
  const { phase } = state;
  return (
    <div className={styles.panel}>
      <p role="status" className={styles.status} data-phase={phase}>
        {copy.phases[phase]}
      </p>
      {state.chainId === undefined ? null : (
        <p className={styles.network}>
          {copy.network}: {state.chainId}
        </p>
      )}
      <div className={styles.actions}>
        {phase === 'connect' ? <Button onClick={onConnect}>{copy.actions.connect}</Button> : null}
        {state.canSwitch ? <Button onClick={onSwitch}>{copy.actions.switch}</Button> : null}
        <Button disabled={!state.canSend} onClick={onSend}>
          {copy.actions.send}
        </Button>
      </div>
      {hash === undefined ? null : (
        <p className={styles.hash}>
          {copy.explorer} <TxLink hash={hash} {...(explorerUrl === undefined ? {} : { url: explorerUrl })} />
        </p>
      )}
      <p className={styles.preSent}>
        {copy.preSent.title}{' '}
        {preSentHash === undefined || preSentUrl === undefined ? (
          copy.preSent.unset
        ) : (
          <TxLink hash={preSentHash} url={preSentUrl} />
        )}
      </p>
    </div>
  );
}
