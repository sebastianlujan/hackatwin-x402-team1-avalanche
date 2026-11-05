import { txUrl } from '@hackatwin/chains/registry';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { copy } from '../../content/copy.ts';
import { FIRST_TX_VALUE } from '../../lib/first-tx.ts';
import { type FirstTxInput, type FirstTxPhase, firstTxState } from '../../lib/first-tx-state.ts';
import { FirstTxPanel, type FirstTxPanelProps } from './FirstTxPanel.tsx';

const hash = `0x${'ab'.repeat(32)}`;
const preSent = `0x${'cd'.repeat(32)}`;
const ready: FirstTxInput = { wallet: 'connected', chainId: 43113, balance: FIRST_TX_VALUE, send: 'idle' };
const noop = () => undefined;
const panel = (input: Partial<FirstTxInput>, props: Partial<FirstTxPanelProps> = {}) =>
  renderToStaticMarkup(
    <FirstTxPanel
      copy={copy.firstTx}
      state={firstTxState({ ...ready, ...input })}
      onConnect={noop}
      onSwitch={noop}
      onSend={noop}
      {...props}
    />,
  );
const anchors = (markup: string) => markup.match(/<a /g)?.length ?? 0;

const everyState: readonly [FirstTxPhase, Partial<FirstTxInput>][] = [
  ['checking', { wallet: 'checking' }],
  ['no-wallet', { wallet: 'none' }],
  ['connect', { wallet: 'disconnected' }],
  ['wrong-network', { chainId: 43114 }],
  ['switch-failed', { chainId: 43114, switchFailed: true }],
  ['no-balance', { balance: 0n }],
  ['idle', {}],
  ['signing', { send: 'signing' }],
  ['pending', { send: 'pending' }],
  ['confirmed', { send: 'confirmed' }],
  ['rejected', { send: 'rejected' }],
  ['failed', { send: 'failed' }],
];

describe('FirstTxPanel', () => {
  it.each(everyState)('shows the %s state copy', (phase, input) => {
    expect(panel(input)).toContain(copy.firstTx.phases[phase]);
  });

  it('disables Send off Fuji and shows the current chain with a switch action', () => {
    const markup = panel({ chainId: 43114 });
    expect(markup).toContain(`${copy.firstTx.network}: 43114`);
    expect(markup).toContain(`>${copy.firstTx.actions.switch}<`);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Send 0.001 AVAX/);
  });

  it('enables Send when ready and offers it again after a rejection', () => {
    expect(panel({})).not.toMatch(/disabled=""[^>]*>Send/);
    expect(panel({ send: 'rejected' })).not.toMatch(/disabled=""[^>]*>Send/);
  });

  it('has no explorer link before a hash exists', () => {
    expect(anchors(panel({ send: 'signing' }))).toBe(0);
  });

  it('links the hash with the chains helper output once it exists', () => {
    const url = txUrl('fuji', hash);
    const markup = panel({ send: 'confirmed' }, { hash, explorerUrl: url });
    expect(anchors(markup)).toBe(1);
    expect(markup).toContain(`href="${url}"`);
  });
});

describe('pre-sent fallback', () => {
  it.each(everyState)('says "not set yet" with no anchor in the %s state when unset', (_phase, input) => {
    const markup = panel(input);
    expect(markup).toContain(copy.firstTx.preSent.unset);
    expect(anchors(markup)).toBe(0);
  });

  it.each(everyState)('offers the chains helper link in the %s state when set', (_phase, input) => {
    const url = txUrl('fuji', preSent);
    const markup = panel(input, { preSentHash: preSent, preSentUrl: url });
    expect(markup).toContain(`href="${url}"`);
    expect(markup).not.toContain(copy.firstTx.preSent.unset);
  });
});
