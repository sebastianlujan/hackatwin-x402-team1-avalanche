import { Demo1Run } from '../../containers/demo-1-run.tsx';
import { anthropicKeyAvailable } from '../../server/root.ts';
import { getRunStore } from '../../server/run-store.ts';

export const dynamic = 'force-dynamic';

// The page only attaches to the latest run; a run starts from a button press, never from a load.
export default function Demo1Page() {
  return <Demo1Run initialRunId={getRunStore().latest()?.id} claudeAvailable={anthropicKeyAvailable()} />;
}
