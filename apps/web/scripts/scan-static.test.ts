import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN, SENTINELS, scanDirectory } from './scan-static.ts';

const tree = (chunk: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-static-'));
  mkdirSync(join(dir, 'chunks'));
  writeFileSync(join(dir, 'chunks', 'a.js'), chunk);
  return dir;
};

describe('scan-static', () => {
  it('passes a clean tree', () => {
    expect(scanDirectory(tree('console.log("hello")'))).toEqual([]);
  });

  it.each([...FORBIDDEN])('fails a tree containing %s', (token) => {
    const [finding] = scanDirectory(tree(`var x = "${token}";`));
    expect(finding?.token).toBe(token);
  });

  it('keeps the CI sentinels in step with the script', () => {
    const ci = readFileSync(join(import.meta.dirname, '../../../.github/workflows/ci.yml'), 'utf8');
    for (const sentinel of SENTINELS) expect(ci).toContain(sentinel);
  });
});
