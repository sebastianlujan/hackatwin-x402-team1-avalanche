import { describe, expect, it } from 'vitest';
import { loadIdentityView } from './identity.ts';

describe('loadIdentityView', () => {
  it('is live when the read succeeds', async () => {
    const view = await loadIdentityView(async () => [{ role: 'agent', agentId: 1n, owner: '0x1' }]);
    expect(view.offline).toBe(false);
  });

  it('falls back to the offline view when the fork read fails, without the cause', async () => {
    const view = await loadIdentityView(async () => {
      throw new Error('fetch failed http://127.0.0.1:8545');
    });
    expect(view.offline).toBe(true);
    expect(JSON.stringify(view)).not.toContain('127.0.0.1');
  });
});
