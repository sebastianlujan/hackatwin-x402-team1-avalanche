import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./quote.ts', import.meta.url), 'utf8');

describe('quote script', () => {
  it('reuses the shared guarded oracle', () => {
    expect(source).toMatch(/import \{[^}]*\bcreateGuardedOracle\b[^}]*\} from '@hackatwin\/pricing'/);
    expect(source).toMatch(/import \{[^}]*\bGuardedOracle\b[^}]*\} from '@hackatwin\/pricing'/);
  });

  it('holds no band arithmetic', () => {
    expect(source).not.toMatch(/10_?000|\b200\b|bps/i);
  });
});
