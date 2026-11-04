import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const tokens = read('packages/ui/src/tokens.css');
const token = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(tokens);
  if (match?.[1] === undefined) throw new Error(`token --${name} is not a hex color`);
  return match[1];
};

const channels = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const linear = (c: number): number => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const hue = (hex: string): number => {
  const [r, g, b] = channels(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

const stylesheets = (dir: string): string[] =>
  readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.css'))
    .map((name) => join(dir, name));

describe('design tokens', () => {
  it('keeps cream text and the accent at 4.5:1 or more on the background', () => {
    expect(contrast(token('hk-fg'), token('hk-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('hk-fg-muted'), token('hk-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('hk-accent'), token('hk-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the accent ink readable on light and in the accent hue', () => {
    expect(contrast(token('hk-accent-ink'), token('hk-paper'))).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(hue(token('hk-accent-ink')) - hue(token('hk-accent')))).toBeLessThan(3);
  });

  it('never uses pure black', () => {
    expect(tokens).not.toMatch(/#0{3,6}\b/);
  });

  it('is the only stylesheet with a color literal', () => {
    const sheets = [
      ...stylesheets('packages/ui/src'),
      ...stylesheets('apps/web/src'),
      ...stylesheets('apps/docs/src'),
    ].filter((file) => file !== 'packages/ui/src/tokens.css');
    expect(sheets.length).toBeGreaterThan(0);
    for (const file of sheets) expect(read(file), file).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/i);
  });

  it('keeps the plain accent off text in the docs light styles', () => {
    const light = read('apps/docs/src/css/custom.css').split(/\[data-theme=['"]dark['"]\]/)[0] ?? '';
    expect(light).toContain('var(--hk-accent-ink)');
    expect(light).not.toMatch(/var\(--hk-accent\)/);
  });
});
