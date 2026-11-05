'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PathNav } from '../components/molecules/PathNav.tsx';
import type { PathCopy } from '../content/copy.ts';
import { nextOf, nextPath, position, previousOf } from '../lib/talk-path.ts';

// Keys only move between screens; they never start a run or send a transaction.
export function PresenterKeys({ copy }: { readonly copy: PathCopy['nav'] }) {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const { key, altKey, ctrlKey, metaKey, shiftKey, defaultPrevented } = event;
      const to = nextPath(path, { key, altKey, ctrlKey, metaKey, shiftKey, defaultPrevented, target });
      if (to === undefined) return;
      event.preventDefault();
      router.push(to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [path, router]);

  const place = position(path);
  if (place === undefined) return null;
  return <PathNav copy={copy} {...place} previous={previousOf(path)} next={nextOf(path)} />;
}
