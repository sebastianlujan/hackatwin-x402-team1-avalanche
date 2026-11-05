import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pnpmCommands, unknownScripts } from './runbook.ts';

const root = join(import.meta.dirname, '..');
const HEADING = 'Demo 2: TwinPay L1';
const doc = readFileSync(join(root, 'docs/demos.md'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
const section = doc.slice(doc.indexOf(`## ${HEADING}`)).split(/\n## /)[0] ?? '';

describe('Demo 2 local runbook', () => {
  it('uses only scripts that exist in the root package.json', () => {
    const commands = pnpmCommands(doc, HEADING);
    expect(commands).toEqual(expect.arrayContaining(['demo2:local:up', 'demo2:setup', 'demo2']));
    expect(unknownScripts(commands, manifest.scripts)).toEqual([]);
  });

  it('says the local run is for development and never the stage demo', () => {
    expect(section).toMatch(/for development only, never the stage demo/i);
  });

  it('shows the simulated banner as the first line of the output', () => {
    expect(section).toContain('SIMULATED (local-crosschain)');
  });
});
