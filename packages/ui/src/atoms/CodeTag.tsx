import type { ReactNode } from 'react';

export interface CodeTagProps {
  readonly children: ReactNode;
}

export function CodeTag({ children }: CodeTagProps) {
  return <code className="hk-code">{children}</code>;
}
