import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptDir = new URL('../script', import.meta.url).pathname;
const stubName = 'WarpMessengerStub';

function filesNaming(dir: string, token: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.sol'))
    .filter((name) => readFileSync(join(dir, name), 'utf8').includes(token));
}

describe('Warp stub is test-only', () => {
  it('finds a file that names the stub, so the scan can fail', () => {
    const dir = mkdtempSync(join(tmpdir(), 'warp-guard-'));
    mkdirSync(join(dir, 'lib'));
    writeFileSync(join(dir, 'lib', 'Bad.sol'), `import { ${stubName} } from 'x';`);
    expect(filesNaming(dir, stubName)).toEqual([join('lib', 'Bad.sol')]);
  });

  it('has no script file naming the stub', () => {
    expect(readdirSync(scriptDir, { recursive: true, encoding: 'utf8' })).toContain(join('lib', 'Registry.sol'));
    expect(filesNaming(scriptDir, stubName)).toEqual([]);
  });
});
