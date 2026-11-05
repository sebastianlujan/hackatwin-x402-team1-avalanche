import '@hackatwin/ui/tokens.css';
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'hackatwin' };

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
