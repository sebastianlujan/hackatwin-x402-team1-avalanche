import { chain, toViemChain } from '@hackatwin/chains/registry';
import type { Chain } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

const FUJI = 43113;

// Fuji only, and only injected wallets: no WalletConnect, no other chain to switch to.
export function createWalletConfig() {
  const fuji = chain('fuji');
  return createConfig({
    // Same chain object; the cast bridges the two viem installs (TypeScript 5.9 here, 7 elsewhere).
    chains: [toViemChain('fuji') as unknown as Chain],
    connectors: [injected()],
    transports: { [FUJI]: http(fuji.rpc?.public) },
    ssr: true,
  });
}
