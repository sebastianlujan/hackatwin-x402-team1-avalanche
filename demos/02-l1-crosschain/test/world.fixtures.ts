import type { Address } from '@hackatwin/core';
import { parseWorld } from '../deployment.ts';

export const a = (n: number) => `0x${n.toString(16).repeat(40)}` as Address;

export const world = parseWorld({
  version: 1,
  instance: 'dev',
  chains: {
    hub: { key: 'local-hub', chainId: 31337, rpcUrl: 'http://127.0.0.1:18545', blockchainId: `0x${'1'.repeat(64)}` },
    l1: { key: 'local-l1', chainId: 31338, rpcUrl: 'http://127.0.0.1:18546', blockchainId: `0x${'2'.repeat(64)}` },
  },
  contracts: {
    usdc: a(1),
    hub: a(2),
    broker: a(3),
    messenger: a(4),
    receiver: a(5),
    router: a(6),
    home: a(10),
    remote: a(11),
    selector: '99',
  },
  roles: { treasury: a(7), agent: a(8), merchant: a(9) },
});
