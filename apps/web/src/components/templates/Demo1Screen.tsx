import { Cursor } from '@hackatwin/ui';
import type { Demo1Copy } from '../../content/copy.ts';
import type { BalanceView, Demo1View } from '../../lib/demo-1-state.ts';
import type { Llm, StreamState } from '../../lib/starter.ts';
import { Section } from '../molecules/Section.tsx';
import { StartControl } from '../molecules/StartControl.tsx';
import { BalancesPanel } from '../organisms/BalancesPanel.tsx';
import { ForkHashes } from '../organisms/ForkHashes.tsx';
import { PaymentStrip } from '../organisms/PaymentStrip.tsx';
import { QuotePanel } from '../organisms/QuotePanel.tsx';
import { Timeline } from '../organisms/Timeline.tsx';
import styles from './Demo1Screen.module.css';

export interface Demo1ScreenProps {
  readonly copy: Demo1Copy;
  readonly view: Demo1View;
  readonly balances?: BalanceView | undefined;
  readonly stream: Pick<StreamState, 'status' | 'error'>;
  readonly scripted: boolean;
  readonly claudeAvailable: boolean;
  readonly busy: boolean;
  readonly postError?: string | undefined;
  readonly onStart: (llm: Llm) => void;
}

export function Demo1Screen({
  copy,
  view,
  balances,
  stream,
  scripted,
  claudeAvailable,
  busy,
  postError,
  onStart,
}: Demo1ScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <Cursor text={copy.brand} />
        <h1>{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
        <StartControl
          copy={copy.start}
          claudeAvailable={claudeAvailable}
          busy={busy}
          scripted={scripted}
          onStart={onStart}
        />
        {postError === undefined ? null : <p role="alert">{postError}</p>}
        {stream.status === 'reconnecting' ? <p role="status">{copy.status.reconnecting}</p> : null}
        {stream.status === 'error' ? (
          <p role="alert">
            {copy.status.error}: {stream.error}
          </p>
        ) : null}
      </header>
      <div className={styles.grid}>
        <Section title={copy.timeline.title}>
          <Timeline copy={copy.timeline} entries={view.timeline} />
        </Section>
        <div className={styles.side}>
          <Section title={copy.strip.label}>
            <PaymentStrip copy={copy.strip} strip={view.strip} />
          </Section>
          <Section title={copy.quote.title}>
            <QuotePanel copy={copy.quote} quote={view.quote} />
          </Section>
          <Section title={copy.balances.title}>
            <BalancesPanel copy={copy.balances} balances={balances} />
          </Section>
          <Section title={copy.fork.title}>
            <ForkHashes copy={copy.fork} hashes={view.forkHashes} />
          </Section>
        </div>
      </div>
    </main>
  );
}
