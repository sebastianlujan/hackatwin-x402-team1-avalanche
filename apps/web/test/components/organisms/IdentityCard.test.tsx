import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IdentityCard } from '../../../src/components/organisms/IdentityCard.tsx';
import { copy } from '../../../src/content/copy.ts';
import { liveView, offlineView } from '../../../src/lib/identity-view.ts';

const owner = `0x${'1'.repeat(40)}`;
const card = (view: Parameters<typeof IdentityCard>[0]['view']) =>
  renderToStaticMarkup(<IdentityCard copy={copy.identity} view={view} />);

describe('IdentityCard', () => {
  it('shows ids and owners live, with no offline label', () => {
    const markup = card(
      liveView([
        { role: 'agent', agentId: 1850n, owner },
        { role: 'seller', agentId: 1851n, owner },
      ]),
    );
    expect(markup).toContain('1850');
    expect(markup).toContain('1851');
    expect(markup).toContain(owner);
    expect(markup).not.toContain(copy.identity.offline);
  });

  it('says reputation is unavailable unless it was read', () => {
    const markup = card(
      liveView([
        { role: 'agent', agentId: 1n, owner },
        { role: 'seller', agentId: 2n, owner, reputation: { count: 2n, value: 90n, valueDecimals: 0 } },
      ]),
    );
    expect(markup).toContain(copy.identity.reputation.unavailable);
    expect(markup).toContain('2 feedback, score 90');
  });

  it('says no feedback yet for a read reputation with a zero count', () => {
    expect(
      card(liveView([{ role: 'agent', agentId: 1n, owner, reputation: { count: 0n, value: 0n, valueDecimals: 0 } }])),
    ).toContain(copy.identity.reputation.none);
  });

  it('labels last-known values offline and never shows a reputation for them', () => {
    const markup = card(offlineView({ agent: { agentId: '7', owner } }));
    expect(markup).toContain(`>${copy.identity.offline}<`);
    expect(markup).toContain(copy.identity.offlineNote);
    expect(markup).toContain('>7<');
    expect(markup).toContain(copy.identity.reputation.unavailable);
  });

  it('says "not set yet" when nothing is known', () => {
    expect(card(offlineView({})).match(new RegExp(copy.identity.notSet, 'g'))).toHaveLength(4);
  });
});
