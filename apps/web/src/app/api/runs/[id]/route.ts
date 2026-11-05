import { createRunHandler } from '../../../../server/handlers.ts';
import { getRunStore } from '../../../../server/run-store.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = createRunHandler({ store: getRunStore() });
