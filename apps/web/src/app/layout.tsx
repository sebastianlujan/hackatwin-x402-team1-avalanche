import '@hackatwin/ui/atoms.css';
import '@hackatwin/ui/tokens.css';
import './globals.css';
import type { ReactNode } from 'react';
import { PresenterKeys } from '../containers/presenter-keys.tsx';
import { copy } from '../content/copy.ts';

export const metadata = { title: 'hackatwin' };

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PresenterKeys copy={copy.path.nav} />
      </body>
    </html>
  );
}
