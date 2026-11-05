import 'server-only';
import { readDemo1Identities } from '@hackatwin/demo-01-x402-twin/module';
import { LAST_KNOWN_IDENTITIES } from '../content/last-known.ts';
import { type IdentityRead, type IdentityView, liveView, offlineView } from '../lib/identity-view.ts';

// A failed read never errors the page and never leaks the cause: it falls back to the last-known ids.
export async function loadIdentityView(
  read: () => Promise<readonly IdentityRead[]> = () => readDemo1Identities(),
): Promise<IdentityView> {
  try {
    return liveView(await read());
  } catch {
    return offlineView(LAST_KNOWN_IDENTITIES);
  }
}
