import { describe, expect, it } from 'vitest';
import { liveView, offlineView } from '../../src/lib/identity-view.ts';

const owner = `0x${'1'.repeat(40)}`;

describe('liveView', () => {
  it('turns ids into text and reads the score with its decimals', () => {
    const view = liveView([
      { role: 'agent', agentId: 1850n, owner },
      { role: 'seller', agentId: 1851n, owner, reputation: { count: 3n, value: 4250n, valueDecimals: 2 } },
    ]);
    expect(view.offline).toBe(false);
    expect(view.rows[0]).toEqual({ role: 'agent', agentId: '1850', owner });
    expect(view.rows[1]?.reputation).toEqual({ count: '3', score: '42.50' });
  });

  it('pads a score below one', () => {
    const [row] = liveView([
      { role: 'agent', agentId: 1n, owner, reputation: { count: 1n, value: 5n, valueDecimals: 3 } },
    ]).rows;
    expect(row?.reputation?.score).toBe('0.005');
  });
});

describe('offlineView', () => {
  it('is labeled offline and keeps the last-known values, with no reputation', () => {
    const view = offlineView({ agent: { agentId: '7', owner } });
    expect(view.offline).toBe(true);
    expect(view.rows).toEqual([{ role: 'agent', agentId: '7', owner }, { role: 'seller' }]);
  });

  it('has empty rows for both roles when nothing is known', () => {
    expect(offlineView({}).rows).toEqual([{ role: 'agent' }, { role: 'seller' }]);
  });
});
