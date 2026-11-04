import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('chains:verify exits 0 against the live public RPCs', () => {
  const out = execFileSync('node', ['packages/chains/scripts/verify.ts'], { encoding: 'utf8' });
  expect(out).not.toMatch(/FAIL/);
  expect(out).toContain('PASS arbitrum');
}, 60_000);
