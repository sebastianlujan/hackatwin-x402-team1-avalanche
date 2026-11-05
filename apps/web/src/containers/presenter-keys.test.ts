import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('PresenterKeys', () => {
  it('only navigates: no fetch, run route or wallet call', () => {
    const keys = source('./presenter-keys.tsx');
    expect(keys).toContain('router.push');
    for (const forbidden of ['fetch(', '/api/', 'wagmi', 'sendTransaction']) expect(keys).not.toContain(forbidden);
  });

  it('is mounted once in the root layout', () => {
    expect(source('../app/layout.tsx')).toContain('<PresenterKeys');
  });
});
