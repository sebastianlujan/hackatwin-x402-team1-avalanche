import { existsSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Demo2 from '../src/app/demo-2/page.tsx';
import Demo3 from '../src/app/demo-3/page.tsx';
import Avalanche from '../src/app/path/avalanche/page.tsx';
import BuiltByAgents from '../src/app/path/built-by-agents/page.tsx';
import FirstTx from '../src/app/path/first-tx/page.tsx';
import Production from '../src/app/path/production/page.tsx';
import { copy } from '../src/content/copy.ts';
import { TALK_PATH } from '../src/lib/talk-path.ts';

const appDir = new URL('../src/app/', import.meta.url);
const pageOf = (path: string) => `${path === '/' ? '' : path.slice(1)}/page.tsx`.replace(/^\//, '');

afterEach(() => vi.unstubAllGlobals());

describe('talk routes', () => {
  it('has a page file for every path in the list', () => {
    for (const path of TALK_PATH) expect(existsSync(new URL(pageOf(path), appDir)), path).toBe(true);
  });
});

describe('static screens', () => {
  it.each([
    [Avalanche, copy.path.screens.avalanche],
    [Production, copy.path.screens.production],
    [BuiltByAgents, copy.path.screens.builtByAgents],
  ])('%s: renders fully without any network call', (Page, screen) => {
    const fetch = vi.fn(() => {
      throw new Error('network call');
    });
    vi.stubGlobal('fetch', fetch);
    const markup = renderToStaticMarkup(<Page />);
    expect(markup).toContain(screen.title);
    for (const item of screen.items) expect(markup).toContain(item.term.replace('&', '&amp;'));
    expect(markup).not.toContain(copy.path.placeholders.badge);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('placeholders', () => {
  it.each([
    [Demo2, copy.path.placeholders.demo2],
    [Demo3, copy.path.placeholders.demo3],
    [FirstTx, copy.path.placeholders.firstTx],
  ])('%s is labeled as a placeholder', (Page, screen) => {
    const markup = renderToStaticMarkup(<Page />);
    expect(markup).toContain(screen.title);
    expect(markup).toContain(`>${copy.path.placeholders.badge}<`);
  });
});
