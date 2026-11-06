import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Home from '../../../src/app/page.tsx';
import { LandingTemplate } from '../../../src/components/templates/LandingTemplate.tsx';
import { copy } from '../../../src/content/copy.ts';

const markup = renderToStaticMarkup(<LandingTemplate copy={copy.landing} />);

describe('LandingTemplate', () => {
  it('shows the hero with the cursor brand and a link into the path', () => {
    expect(markup).toContain('&gt; HACKATWIN<span');
    expect(markup).toContain(`<h1>${copy.landing.hero.title}</h1>`);
    expect(markup).toContain(`href="${copy.landing.hero.cta.href}"`);
  });

  it('has the manifesto, both cards, the tagline and the FAQ landmarks', () => {
    expect(markup).toContain(`aria-label="${copy.landing.manifesto.title}"`);
    expect(markup).toContain(`aria-label="${copy.landing.cards.title}"`);
    for (const item of copy.landing.cards.items) expect(markup).toContain(`>${item.mark}<`);
    expect(markup).toContain(copy.landing.tagline.text);
    expect(markup).toContain(`aria-label="${copy.landing.faq.title}"`);
    expect(markup.match(/<details/g)).toHaveLength(copy.landing.faq.items.length);
  });

  it('links to Avalanche as plain text with no image', () => {
    expect(markup).toContain(`>${copy.landing.builtOn.label}</a>`);
    expect(markup).toContain(`href="${copy.landing.builtOn.href}"`);
    expect(markup).not.toMatch(/<img|<svg/);
  });

  it('is what the home route renders', () => {
    expect(renderToStaticMarkup(<Home />)).toBe(markup);
  });

  it('collapses to one column below 768px', () => {
    const css = readFileSync(
      new URL('../../../src/components/templates/LandingTemplate.module.css', import.meta.url),
      'utf8',
    );
    expect(css).toMatch(/@media \(max-width: 767px\)\s*\{\s*\.grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  });
});
