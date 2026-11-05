import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pnpmCommands, unknownScripts } from './runbook.ts';

const root = join(import.meta.dirname, '..');

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

describe('Demo 1 runbook', () => {
  it('uses only scripts that exist in the root package.json', () => {
    const commands = pnpmCommands(readFileSync(join(root, 'docs/demos.md'), 'utf8'), 'Demo 1: x402 + Twin');
    expect(commands).toEqual(
      expect.arrayContaining([
        'demo1:fork',
        'demo1:fund',
        'demo1:register',
        'demo1:facilitator',
        'demo1:seller',
        'demo1',
      ]),
    );
    expect(unknownScripts(commands, manifest.scripts)).toEqual([]);
  });

  it('fails on an unknown script name', () => {
    const doc = '## Demo 1: x\n\n```bash\npnpm demo1:fork\npnpm demo1:warp\n```\n\n## Demo 2\n\npnpm other\n';
    expect(unknownScripts(pnpmCommands(doc, 'Demo 1: x'), manifest.scripts)).toEqual(['demo1:warp']);
  });

  it('stops at the next section', () => {
    expect(pnpmCommands('## Demo 1: x\npnpm demo1\n## Demo 2\npnpm other\n', 'Demo 1: x')).toEqual(['demo1']);
  });
});
