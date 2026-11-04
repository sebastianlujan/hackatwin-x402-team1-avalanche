import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const files = ['apps/web/src/components/**/*.tsx', 'packages/ui/src/**/*.tsx']
  .flatMap((pattern) => globSync(pattern, { cwd: root }))
  .filter((file) => !file.endsWith('.test.tsx'));

const ATTRIBUTE = /\b(?:aria-label|aria-description|title|alt|placeholder)="[^"{]*[A-Za-z][^"]*"/g;
// Text between an element tag and the next tag, outside any expression.
const TEXT = /<\/?[A-Za-z][^<>]*>\s*([^<>{}\n]*[A-Za-z][^<>{}\n]*?)\s*</g;

const literals = (source: string): string[] => [
  ...(source.match(ATTRIBUTE) ?? []),
  ...[...source.matchAll(TEXT)].map((match) => match[1] ?? ''),
];

describe('copy scan', () => {
  it('finds literals in a sample so the scan itself is trusted', () => {
    expect(literals('<p title="Hello">{x}</p>')).toEqual(['title="Hello"']);
    expect(literals('<p>Hello</p>')).toEqual(['Hello']);
    expect(literals('<p>{copy.hello}</p>')).toEqual([]);
  });

  it('sees the component and ui files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('finds no literal user-facing text in components or ui atoms', () => {
    for (const file of files) expect(literals(readFileSync(resolve(root, file), 'utf8')), file).toEqual([]);
  });
});

describe('accuracy pins', () => {
  it('keeps the Twin, FAQ and Demo 1 lines true to the docs', async () => {
    const { copy } = await import('../src/content/copy.ts');
    const twin = copy.landing.cards.items.find((item) => item.mark === 'Twin');
    expect(twin?.text).toBe('ARGt, the Argentine peso token Demo 1 pays with on a local fork of the C-Chain.');
    expect(copy.demo1.lead).toBe(
      'An agent pays ARGt over x402 for one API response, on a local fork of the Avalanche C-Chain.',
    );
    const faq = JSON.stringify(copy.landing);
    expect(faq).toContain('team1 directs it; agents write most of the repository.');
    expect(faq).not.toContain('Twin and team1 direct it');
  });
});
