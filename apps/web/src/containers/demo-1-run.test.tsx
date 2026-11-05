import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { paymentRequired, runStarted } from '../../test/events.ts';
import type { StreamState } from '../lib/starter.ts';
import { Demo1RunView, type Demo1RunViewProps } from './demo-1-run.tsx';

const idle: StreamState = { status: 'idle', frames: [] };
const html = (props: Partial<Demo1RunViewProps> = {}): string =>
  renderToStaticMarkup(
    <Demo1RunView stream={idle} claudeAvailable busy={false} onStart={() => undefined} {...props} />,
  );

describe('Demo1RunView', () => {
  it('disables Claude with the reason when the server has no key', () => {
    const markup = html({ claudeAvailable: false });
    expect(markup).toContain('the server has no ANTHROPIC_API_KEY');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Run with Claude/);
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Run scripted/);
  });

  it('shows the Scripted badge for the whole run and lists frames in order', () => {
    const frames = [
      { seq: 1, source: 'live', event: runStarted },
      { seq: 2, source: 'live', event: paymentRequired },
    ] as const;
    const markup = html({ stream: { status: 'live', frames }, busy: true });
    expect(markup).toContain('<p>Scripted</p>');
    expect(markup.indexOf('1 run.started')).toBeLessThan(markup.indexOf('2 payment.required'));
    expect(markup).toMatch(/<button[^>]*disabled=""/);
  });

  it('renders Reconnecting, the decode error and the POST command text', () => {
    expect(html({ stream: { status: 'reconnecting', frames: [] } })).toContain('Reconnecting');
    expect(html({ stream: { status: 'error', frames: [], error: 'Unsupported AgentEvent version: 2' } })).toContain(
      'Unsupported AgentEvent version: 2',
    );
    expect(html({ postError: 'the agent is not funded: run pnpm demo1:fund' })).toContain('pnpm demo1:fund');
  });

  it('offers no replay control', () => {
    expect(html()).not.toMatch(/replay/i);
  });
});
