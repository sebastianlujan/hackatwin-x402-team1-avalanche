import { IdentityCard } from '../../../components/organisms/IdentityCard.tsx';
import { TalkScreen } from '../../../components/templates/TalkScreen.tsx';
import { copy } from '../../../content/copy.ts';
import { loadIdentityView } from '../../../server/identity.ts';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { title, lead } = copy.identity;
  return (
    <TalkScreen brand={copy.demo1.brand} copy={{ title, lead, items: [] }}>
      <IdentityCard copy={copy.identity} view={await loadIdentityView()} />
    </TalkScreen>
  );
}
