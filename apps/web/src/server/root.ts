import 'server-only';
import { ConfigError, loadProfile } from '@hackatwin/config';
import { startDemo1Run } from '@hackatwin/demo-01-x402-twin/module';
import type { Llm } from './handlers.ts';
import type { StartedRun } from './run-store.ts';

// Each run composes the profile, keystores and guarded fork itself, so a fork restart is picked up.
export const openRun = (llm: Llm): Promise<StartedRun> => startDemo1Run({ llm });

// The key is the only thing the Claude button needs from the environment.
export function anthropicKeyAvailable(): boolean {
  try {
    loadProfile('cchain-fork', undefined, { llm: 'claude' });
    return true;
  } catch (error) {
    return !(error instanceof ConfigError && error.issues.some((i) => i.variable === 'ANTHROPIC_API_KEY'));
  }
}
