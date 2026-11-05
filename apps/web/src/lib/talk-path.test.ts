import { describe, expect, it } from 'vitest';
import { type NavKeyEvent, nextPath, position } from './talk-path.ts';

const press = (key: string, patch: Partial<NavKeyEvent> = {}): NavKeyEvent => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  defaultPrevented: false,
  target: { tagName: 'BODY' },
  ...patch,
});

describe('nextPath', () => {
  it('goes to the next screen on ArrowRight and PageDown', () => {
    expect(nextPath('/path/avalanche', press('ArrowRight'))).toBe('/path/first-tx');
    expect(nextPath('/path/avalanche', press('PageDown'))).toBe('/path/first-tx');
  });

  it('goes to the previous screen on ArrowLeft and PageUp, and to the first on Home', () => {
    expect(nextPath('/demo-1', press('ArrowLeft'))).toBe('/path/identity');
    expect(nextPath('/demo-1', press('PageUp'))).toBe('/path/identity');
    expect(nextPath('/demo-1', press('Home'))).toBe('/');
  });

  it('does not wrap at either end', () => {
    expect(nextPath('/path/built-by-agents', press('ArrowRight'))).toBeUndefined();
    expect(nextPath('/', press('ArrowLeft'))).toBeUndefined();
    expect(nextPath('/', press('Home'))).toBeUndefined();
  });

  it('is ignored with a modifier, a handled event, or focus in an editable element', () => {
    const path = '/path/avalanche';
    for (const patch of [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { defaultPrevented: true },
    ])
      expect(nextPath(path, press('ArrowRight', patch))).toBeUndefined();
    for (const tagName of ['INPUT', 'textarea', 'SELECT'])
      expect(nextPath(path, press('ArrowRight', { target: { tagName } }))).toBeUndefined();
    expect(
      nextPath(path, press('ArrowRight', { target: { tagName: 'DIV', isContentEditable: true } })),
    ).toBeUndefined();
  });

  it('ignores other keys and paths outside the list, and tolerates a trailing slash', () => {
    expect(nextPath('/path/avalanche', press('a'))).toBeUndefined();
    expect(nextPath('/elsewhere', press('ArrowRight'))).toBeUndefined();
    expect(nextPath('/demo-1/', press('ArrowRight'))).toBe('/demo-2');
  });
});

describe('position', () => {
  it('numbers the screens from one', () => {
    expect(position('/')).toEqual({ index: 1, total: 9 });
    expect(position('/demo-1')).toEqual({ index: 5, total: 9 });
    expect(position('/nope')).toBeUndefined();
  });
});
