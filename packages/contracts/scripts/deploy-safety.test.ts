import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('../../..', import.meta.url).pathname;
// Built from parts so the policy secret scan does not flag this file
const forbidden = [['PRIVATE', 'KEY'].join('_'), ['', '', 'private', 'key'].join('-'), ['', '', 'broadcast'].join('-')];

function files(dir: string, extension: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith(extension))
    .map((name) => join(dir, name));
}

const scripts = files('packages/contracts/script', '.sol');
const workflows = [...files('.github/workflows', '.yml'), ...files('.github/workflows', '.yaml')];

describe('deploy safety', () => {
  it('scans the deploy scripts and the workflows', () => {
    expect(scripts).toContain(join('packages/contracts/script', 'lib/Registry.sol'));
    expect(workflows).toContain(join('.github/workflows', 'ci.yml'));
  });

  it.each(forbidden)('has no %s in script or workflow files', (token) => {
    const hits = [...scripts, ...workflows].filter((file) => readFileSync(join(root, file), 'utf8').includes(token));
    expect(hits).toEqual([]);
  });
});
