import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Demo1Screen, type Demo1ScreenProps } from '../../../src/components/templates/Demo1Screen.tsx';
import { copy } from '../../../src/content/copy.ts';
import { balanceView, deriveDemo1 } from '../../../src/lib/demo-1-state.ts';
import type { Envelope } from '../../../src/lib/envelope.ts';
import { modeBadge, type StreamState } from '../../../src/lib/starter.ts';
import { feedback, paymentRequired, received, runFinished, runStarted } from '../../events.ts';

const idle: StreamState = { status: 'idle', frames: [] };
const framesOf = (...events: Envelope['event'][]): Envelope[] =>
  events.map((event, i) => ({ seq: i + 1, source: 'live', event }));

const html = (stream: StreamState = idle, props: Partial<Demo1ScreenProps> = {}): string =>
  renderToStaticMarkup(
    <Demo1Screen
      copy={copy.demo1}
      view={deriveDemo1(stream.frames)}
      stream={stream}
      scripted={modeBadge(stream.frames) !== undefined}
      claudeAvailable
      busy={false}
      onStart={() => undefined}
      {...props}
    />,
  );

describe('Demo1Screen', () => {
  it('disables Claude with the reason when the server has no key', () => {
    const markup = html(idle, { claudeAvailable: false });
    expect(markup).toContain('the server has no ANTHROPIC_API_KEY');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Run with Claude/);
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Run scripted/);
  });

  it('shows the Scripted badge for the whole run and disables both buttons while it is active', () => {
    const live: StreamState = { status: 'live', frames: framesOf(runStarted, paymentRequired) };
    const markup = html(live, { busy: true });
    expect(markup).toContain('hk-badge--accent">Scripted<');
    expect(markup.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
    expect(html()).not.toContain('hk-badge--accent">Scripted<');
  });

  it('shows the strip, timeline, quote, balances and fork hashes of a finished run', () => {
    const frames = framesOf(runStarted, paymentRequired, received, feedback, runFinished);
    const balances = balanceView({ agent: '10', seller: '0' }, { agent: '7', seller: '3' });
    const markup = html({ status: 'finished', frames }, { balances });
    for (const text of ['Agent timeline', 'Payment', 'market rate, not official', 'curve', 'moved', 'fork']) {
      expect(markup).toContain(text);
    }
    expect(markup).not.toContain('<a');
  });

  it('renders Reconnecting, the decode error and the POST command text', () => {
    expect(html({ status: 'reconnecting', frames: [] })).toContain('Reconnecting');
    expect(html({ status: 'error', frames: [], error: 'Unsupported AgentEvent version: 2' })).toContain(
      'Stream error: Unsupported AgentEvent version: 2',
    );
    expect(html(idle, { postError: 'the agent is not funded: run pnpm demo1:fund' })).toContain('pnpm demo1:fund');
  });

  it('offers no replay control', () => {
    expect(html()).not.toMatch(/replay/i);
  });
});
