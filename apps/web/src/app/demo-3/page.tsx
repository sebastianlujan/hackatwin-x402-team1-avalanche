import { TalkScreen } from '../../components/templates/TalkScreen.tsx';
import { copy } from '../../content/copy.ts';

export default function Page() {
  return (
    <TalkScreen brand={copy.demo1.brand} copy={copy.path.placeholders.demo3} badge={copy.path.placeholders.badge} />
  );
}
