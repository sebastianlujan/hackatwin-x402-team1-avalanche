import { txUrl } from '@hackatwin/chains/registry';

export const FUJI_CHAIN_ID = 43113;
// 0.001 AVAX in wei.
export const FIRST_TX_VALUE = 10n ** 15n;

// The wallet signs and sends this itself: no server route and no server-held key.
export const buildFirstTx = (account: `0x${string}`) => ({ to: account, value: FIRST_TX_VALUE }) as const;

// Explorer links come from the chains helper, never from a hardcoded host.
export const fujiTxUrl = (hash: string | undefined): string | undefined =>
  hash === undefined ? undefined : txUrl('fuji', hash);
