// The Screen column of PLAN section 7, in talk order.
export const TALK_PATH = [
  '/',
  '/path/avalanche',
  '/path/first-tx',
  '/path/identity',
  '/demo-1',
  '/demo-2',
  '/demo-3',
  '/path/production',
  '/path/built-by-agents',
] as const;

export type TalkPath = (typeof TALK_PATH)[number];

export interface NavKeyEvent {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly defaultPrevented: boolean;
  readonly target: { readonly tagName?: string; readonly isContentEditable?: boolean } | null;
}

const NEXT = new Set(['ArrowRight', 'PageDown']);
const PREVIOUS = new Set(['ArrowLeft', 'PageUp']);
const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const indexOf = (path: string): number => TALK_PATH.indexOf((path.replace(/\/+$/, '') || '/') as TalkPath);

export function position(path: string): { readonly index: number; readonly total: number } | undefined {
  const i = indexOf(path);
  return i === -1 ? undefined : { index: i + 1, total: TALK_PATH.length };
}

export const previousOf = (path: string): TalkPath | undefined => TALK_PATH[indexOf(path) - 1];
export const nextOf = (path: string): TalkPath | undefined =>
  indexOf(path) === -1 ? undefined : TALK_PATH[indexOf(path) + 1];

// The route a key leads to, or undefined when the key is ignored or the path has no neighbour (no wrap).
export function nextPath(path: string, event: NavKeyEvent): TalkPath | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return undefined;
  if (event.target?.isContentEditable === true || EDITABLE.has(event.target?.tagName?.toUpperCase() ?? ''))
    return undefined;
  if (indexOf(path) === -1) return undefined;
  if (event.key === 'Home') return indexOf(path) === 0 ? undefined : TALK_PATH[0];
  if (NEXT.has(event.key)) return nextOf(path);
  return PREVIOUS.has(event.key) ? previousOf(path) : undefined;
}
