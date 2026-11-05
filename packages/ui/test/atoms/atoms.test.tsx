import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge, Button, Cursor, TxLink } from '../../src/index.ts';

const css = readFileSync(resolve(import.meta.dirname, '../../src/atoms.css'), 'utf8');
const hash = `0x${'ab'.repeat(32)}`;

// Drops every no-preference media block, so what is left applies to reduced motion too.
const withoutMotion = (source: string): string => {
  const start = source.indexOf('@media (prefers-reduced-motion: no-preference)');
  if (start === -1) return source;
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return withoutMotion(source.slice(0, start) + source.slice(i + 1));
  }
  return source;
};

describe('atoms', () => {
  it('render without a provider', () => {
    expect(renderToStaticMarkup(<Button>Start</Button>)).toContain('<button type="button" class="hk-button');
    expect(renderToStaticMarkup(<Button disabled>Start</Button>)).toContain('disabled=""');
    expect(renderToStaticMarkup(<Badge tone="accent">Scripted</Badge>)).toContain('hk-badge--accent');
    expect(renderToStaticMarkup(<Cursor text="> HACKATWIN" />)).toContain('&gt; HACKATWIN<span');
  });

  it('shows a hash without an anchor when there is no URL', () => {
    const markup = renderToStaticMarkup(<TxLink hash={hash} />);
    expect(markup).not.toContain('<a');
    expect(markup).toContain(hash);
  });

  it('shows one anchor to the URL, in a new tab, when there is one', () => {
    const markup = renderToStaticMarkup(<TxLink hash={hash} url="https://example.test/tx/1" />);
    expect(markup.match(/<a /g)).toHaveLength(1);
    expect(markup).toContain('href="https://example.test/tx/1"');
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"');
  });
});

describe('atoms.css', () => {
  it('shows a focus ring on Button and the TxLink anchor', () => {
    expect(css).toMatch(/\.hk-button:focus-visible/);
    expect(css).toMatch(/\.hk-tx--link:focus-visible/);
  });

  it('declares the Cursor blink only when motion is allowed', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)[^}]*\{[^}]*\.hk-cursor__caret[^}]*animation:/,
    );
    expect(withoutMotion(css)).not.toMatch(/animation|@keyframes/);
  });
});
