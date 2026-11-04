import type { ReactNode } from 'react';

export interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: 'accent' | 'plain';
}

export function Badge({ children, tone = 'plain' }: BadgeProps) {
  return <span className={`hk-badge hk-badge--${tone}`}>{children}</span>;
}
