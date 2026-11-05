import { describe, expect, it } from 'vitest';
import { redact } from '../../src/server/redact.ts';

describe('redact', () => {
  it('replaces URLs', () => {
    expect(redact('failed at http://127.0.0.1:8545/rpc?k=1 now')).toBe('failed at [url] now');
  });

  it('replaces absolute paths', () => {
    expect(redact('cannot read /Users/me/.demo1/keystore/agent.json')).toBe('cannot read [path]');
    expect(redact('cannot read C:\\keys\\agent.json')).toBe('cannot read [path]');
  });

  it('keeps commands, variable names and plain text', () => {
    const text = 'run pnpm demo1:fund and set KEYSTORE_DIR, either/or';
    expect(redact(text)).toBe(text);
  });
});
