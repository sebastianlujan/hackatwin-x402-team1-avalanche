import { describe, expect, it } from 'vitest';
import { parseRunRecord } from '../../src/lib/run-record.ts';

describe('parseRunRecord', () => {
  it('reads the balances of a run record', () => {
    const before = { agent: '10', seller: '0' };
    expect(parseRunRecord({ id: 'r', before, after: null })).toEqual({ before, after: undefined });
    expect(parseRunRecord({ before, after: { agent: '7', seller: '3' } }).after).toEqual({ agent: '7', seller: '3' });
  });

  it('treats an unreadable body as no balances', () => {
    expect(parseRunRecord(null)).toEqual({ before: undefined, after: undefined });
    expect(parseRunRecord({ before: { agent: 1, seller: 0 } }).before).toBeUndefined();
  });
});
