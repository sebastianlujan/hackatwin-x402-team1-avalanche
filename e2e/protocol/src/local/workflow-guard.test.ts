import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './teleporter.ts';

const dir = join(repoRoot, '.github/workflows');
const workflows = readdirSync(dir)
  .filter((name) => name.endsWith('.yml'))
  .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
const ci = workflows.find((w) => w.name === 'ci.yml')?.text ?? '';
const job = (name: string): string =>
  ci.match(new RegExp(`\\n  ${name}:\\n[\\s\\S]*?(?=\\n  [a-z-]+:\\n|$)`))?.[0] ?? '';

describe('Workflow guards', () => {
  it('no workflow passes a private key on the command line', () => {
    expect(workflows.length).toBeGreaterThan(1);
    for (const { text } of workflows) expect(text).not.toContain('--private-key');
  });

  it('the local job runs the pinned fetch and the local tests, and checks the tree stays clean', () => {
    const local = job('local');
    expect(local).toContain('pnpm local:icm');
    expect(local).toContain('pnpm test:local');
    expect(local).toContain('.cache/icm-services');
    expect(local).toContain('v1.5.1');
    expect(local).toContain('git status --porcelain');
  });

  it('ci-gate waits for the local job', () => {
    expect(job('ci-gate')).toMatch(/needs:\s*\[[^\]]*\blocal\b/);
  });
});
