import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { copy } from '../../content/copy.ts';
import { PathNav } from './PathNav.tsx';

const nav = (props: Partial<Parameters<typeof PathNav>[0]>) =>
  renderToStaticMarkup(<PathNav copy={copy.path.nav} index={2} total={9} {...props} />);

describe('PathNav', () => {
  it('shows the position with previous and next links', () => {
    const markup = nav({ previous: '/', next: '/path/first-tx' });
    expect(markup).toContain('2 / 9');
    expect(markup).toContain('rel="prev"');
    expect(markup).toContain('href="/path/first-tx"');
  });

  it('has no link at the ends', () => {
    expect(nav({ index: 1, next: '/path/avalanche' })).not.toContain('rel="prev"');
    expect(nav({ index: 9, previous: '/path/production' })).not.toContain('rel="next"');
  });
});
