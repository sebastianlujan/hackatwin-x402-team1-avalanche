import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const ASSET = /\.(?:svg|png|jpe?g|gif|webp|avif|ico)$/i;
const MARK = /twin|team-?1|avalanche|avax/i;

const assets = (dir: string): string[] =>
  existsSync(resolve(root, dir))
    ? readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' }).filter((name) => ASSET.test(name))
    : [];

// O4 is open: Twin, team1 and Avalanche are text marks until the logos are approved.
describe('marks', () => {
  it('ships no logo image or SVG for Twin, team1 or Avalanche', () => {
    const dirs = ['apps/web/public', 'apps/web/src', 'packages/ui/src', 'apps/docs/static', 'apps/docs/src', 'docs'];
    const found = dirs.flatMap((dir) => assets(dir).map((name) => `${dir}/${name}`));
    expect(found.filter((path) => MARK.test(path))).toEqual([]);
  });

  it('would catch a logo by name', () => {
    expect(MARK.test('public/avalanche-logo.svg')).toBe(true);
    expect(ASSET.test('public/avalanche-logo.svg')).toBe(true);
    expect(MARK.test('diagrams/demo-1.svg')).toBe(false);
  });
});
