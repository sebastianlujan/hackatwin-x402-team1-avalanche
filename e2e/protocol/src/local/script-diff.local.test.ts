import { describe, expect, it } from 'vitest';
import { runGit } from './icm-services.ts';
import { repoRoot } from './teleporter.ts';

const DEMO2_BASE = '4a6f791abeeefff46876cad65ccf4acbce433970';

describe('Script diff', () => {
  // The demo-2 change adds no Solidity: drop this guard when the change is archived.
  it('Script diff: src and script match the commit the demo-2 queue started from', async () => {
    const paths = ['packages/contracts/src', 'packages/contracts/script'];
    const changed = (from: string) => runGit(['-C', repoRoot, 'diff', '--name-only', from, 'HEAD', '--', ...paths]);
    expect(await changed(DEMO2_BASE)).toBe('');
    const root = (await runGit(['-C', repoRoot, 'rev-list', '--max-parents=0', 'HEAD'])).split('\n')[0] ?? '';
    expect(await changed(root)).toContain('packages/contracts/src');
  });
});
