import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');

// The commands in a section of demos.md: every `pnpm <script>` token.
export function pnpmCommands(markdown: string, heading: string): string[] {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`no "${heading}" section`);
  const rest = markdown.slice(start + 1);
  const end = rest.search(/\n## /);
  const section = end < 0 ? rest : rest.slice(0, end);
  return [...section.matchAll(/\bpnpm\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1] as string);
}

export function unknownScripts(commands: readonly string[], scripts: Readonly<Record<string, string>>): string[] {
  return [...new Set(commands)].filter((name) => scripts[name] === undefined);
}

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
