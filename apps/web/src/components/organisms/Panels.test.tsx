import { readFileSync } from 'node:fs';
import { type AgentEvent, money } from '@hackatwin/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { feedback, paymentRequired } from '../../../test/events.ts';
import { copy } from '../../content/copy.ts';
import { balanceView, deriveDemo1 } from '../../lib/demo-1-state.ts';
import type { Envelope } from '../../lib/envelope.ts';
import { BalancesPanel } from './BalancesPanel.tsx';
import { ForkHashes } from './ForkHashes.tsx';
import { QuotePanel } from './QuotePanel.tsx';

const at = 1_700_000_000_000;
const view = (...events: AgentEvent[]) =>
  deriveDemo1(events.map((event, i): Envelope => ({ seq: i + 1, source: 'live', event })));
const reasoning: AgentEvent = { version: 1, at, type: 'llm.reasoning', text: 'I read the rate' };
const status: AgentEvent = {
  version: 1,
  at,
  type: 'payment.status',
  paymentId: '0xpay',
  chainId: 43114,
  from: 'Pending',
  to: 'Settled',
  txHash: `0x${'cd'.repeat(32)}`,
};
const quote = (guarded: boolean, source: 'curve' | 'chainlink'): AgentEvent =>
  paymentRequired.type === 'payment.required'
    ? { ...paymentRequired, quote: { ...paymentRequired.quote, guarded, source } }
    : paymentRequired;

const quoteOf = () => (paymentRequired.type === 'payment.required' ? paymentRequired.quote : (undefined as never));

describe('QuotePanel', () => {
  const panel = (...events: AgentEvent[]) =>
    renderToStaticMarkup(<QuotePanel copy={copy.demo1.quote} quote={view(...events).quote} />);

  it('shows the source and the disclaimer, and no guard flag when healthy', () => {
    const markup = panel(quote(false, 'curve'));
    expect(markup).toContain('curve');
    expect(markup).toContain('market rate, not official');
    expect(markup).not.toContain(copy.demo1.quote.guard);
  });

  it('shows a text guard flag when guarded', () => {
    const markup = panel(quote(true, 'chainlink'));
    expect(markup).toContain('chainlink');
    expect(markup).toContain(`>${copy.demo1.quote.guard}<`);
    expect(markup).toContain('market rate, not official');
  });

  it('shows an empty state before a quote', () => {
    expect(panel(reasoning)).toContain(copy.demo1.quote.empty);
  });
});

describe('BalancesPanel and ForkHashes', () => {
  it('shows the moved amount as the difference of the balances', () => {
    const balances = balanceView(
      { agent: '16583687000000000000000', seller: '0' },
      { agent: '16581187000000000000000', seller: '2500000000000000000' },
    );
    const markup = renderToStaticMarkup(<BalancesPanel copy={copy.demo1.balances} balances={balances} />);
    expect(markup).toContain('<code title="2.500000000000000000 ARGt">2.50 ARGt</code>');
    expect(markup).toContain('>-2.50 ARGt<');
    expect(markup).toContain('>+2.50 ARGt<');
    expect(markup).toContain('title="16583.687000000000000000 ARGt">16,583.69 ARGt<');
  });

  it('shows the rate as ARGt per USD and keeps full precision in titles', () => {
    const rate = money(602_998_486_683_567n, 18, 'USD');
    const amount = money(16_583_789_546_469_718_423n, 18, 'ARGt');
    const event: AgentEvent = {
      version: 1,
      at,
      type: 'payment.required',
      resource: 'r',
      quote: { ...quoteOf(), rate, amount },
    };
    const markup = renderToStaticMarkup(<QuotePanel copy={copy.demo1.quote} quote={view(event).quote} />);
    expect(markup).toContain('>1 USD = 1658.4 ARGt<');
    expect(markup).toContain('title="16.583789546469718423 ARGt">16.58 ARGt<');
    expect(markup).toContain('title="0.000602998486683567 USD"');
  });

  it('waits for the after balance and has an empty state', () => {
    const before = balanceView({ agent: '5', seller: '0' }, undefined);
    expect(renderToStaticMarkup(<BalancesPanel copy={copy.demo1.balances} balances={before} />)).toContain(
      copy.demo1.balances.pending,
    );
    expect(renderToStaticMarkup(<BalancesPanel copy={copy.demo1.balances} />)).toContain(copy.demo1.balances.empty);
  });

  it('labels every fork hash and renders no anchor for it', () => {
    const { forkHashes } = view(status, feedback);
    const markup = renderToStaticMarkup(<ForkHashes copy={copy.demo1.fork} hashes={forkHashes} />);
    expect(markup).toContain(`0x${'cd'.repeat(32)}`);
    expect(markup).toContain(`0x${'ab'.repeat(32)}`);
    expect(markup.match(new RegExp(`>${copy.demo1.fork.label}<`, 'g'))).toHaveLength(2);
    expect(markup).not.toContain('<a');
  });
});

describe('number layout', () => {
  const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

  it('keeps row headers whole, aligns numbers right and uses tabular figures', () => {
    const balances = css('./BalancesPanel.module.css');
    expect(balances).toMatch(/th\[scope="row"\]\s*\{[^}]*white-space: nowrap/);
    expect(balances).toMatch(/td,[^{]*\{[^}]*text-align: right/);
    expect(balances).toContain('tabular-nums');
    expect(css('./QuotePanel.module.css')).toContain('tabular-nums');
  });

  it('stacks the two columns before the side panel can overflow', () => {
    expect(css('../templates/Demo1Screen.module.css')).toMatch(/max-width: 1023px/);
  });
});
