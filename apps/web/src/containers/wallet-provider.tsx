'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { createWalletConfig } from '../lib/wallet-config.ts';

// Scoped to the first transaction screen: no other route loads wagmi.
export function WalletProvider({ children }: { readonly children: ReactNode }) {
  const [config] = useState(createWalletConfig);
  const [queries] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queries}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
