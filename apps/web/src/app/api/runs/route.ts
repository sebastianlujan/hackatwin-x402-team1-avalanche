import { createStartHandler } from '../../../server/handlers.ts';
import { anthropicKeyAvailable, openRun } from '../../../server/root.ts';
import { getRunStore } from '../../../server/run-store.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createStartHandler({
  store: getRunStore(),
  open: openRun,
  hasAnthropicKey: anthropicKeyAvailable,
});
