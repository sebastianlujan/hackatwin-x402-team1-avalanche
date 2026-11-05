import { TalkScreen } from '../../../components/templates/TalkScreen.tsx';
import { FirstTx } from '../../../containers/first-tx.tsx';
import { WalletProvider } from '../../../containers/wallet-provider.tsx';
import { copy } from '../../../content/copy.ts';
import { PRE_SENT_HASH } from '../../../content/pre-sent.ts';
import { fujiTxUrl } from '../../../lib/first-tx.ts';

export default function Page() {
  const { title, lead } = copy.firstTx;
  return (
    <TalkScreen brand={copy.demo1.brand} copy={{ title, lead, items: [] }}>
      <WalletProvider>
        <FirstTx copy={copy.firstTx} preSentHash={PRE_SENT_HASH} preSentUrl={fujiTxUrl(PRE_SENT_HASH)} />
      </WalletProvider>
    </TalkScreen>
  );
}
