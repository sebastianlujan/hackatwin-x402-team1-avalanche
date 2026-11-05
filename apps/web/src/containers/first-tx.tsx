'use client';

import { useEffect, useState } from 'react';
import {
  useBalance,
  useConnect,
  useConnection,
  useConnectors,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { FirstTxPanel } from '../components/organisms/FirstTxPanel.tsx';
import type { FirstTxCopy } from '../content/copy.ts';
import { buildFirstTx, FUJI_CHAIN_ID, fujiTxUrl } from '../lib/first-tx.ts';
import { type FirstTxInput, firstTxState, isUserRejection } from '../lib/first-tx-state.ts';

export interface FirstTxProps {
  readonly copy: FirstTxCopy;
  readonly preSentHash?: string | undefined;
  readonly preSentUrl?: string | undefined;
}

function sendStatus(
  tx: ReturnType<typeof useSendTransaction>,
  receipt: ReturnType<typeof useWaitForTransactionReceipt>,
): FirstTxInput['send'] {
  if (tx.isError) return isUserRejection(tx.error) ? 'rejected' : 'failed';
  if (tx.data !== undefined) {
    if (receipt.isError || (receipt.data as { status?: string } | undefined)?.status === 'reverted') return 'failed';
    return receipt.isSuccess ? 'confirmed' : 'pending';
  }
  return tx.isPending ? 'signing' : 'idle';
}

// The wallet signs and sends one self-transfer on Fuji; the page holds no key and has no server route for it.
export function FirstTx({ copy, preSentHash, preSentUrl }: FirstTxProps) {
  const { address, chainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const switcher = useSwitchChain();
  const tx = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({ hash: tx.data });
  const balance = useBalance({ address, chainId: FUJI_CHAIN_ID, query: { enabled: address !== undefined } });
  const [hasWallet, setHasWallet] = useState<boolean>();
  useEffect(() => setHasWallet('ethereum' in window), []);

  const state = firstTxState({
    wallet: hasWallet === undefined ? 'checking' : !hasWallet ? 'none' : isConnected ? 'connected' : 'disconnected',
    chainId,
    balance: balance.data?.value,
    send: sendStatus(tx, receipt),
    switchFailed: switcher.isError,
  });

  return (
    <FirstTxPanel
      copy={copy}
      state={state}
      hash={tx.data}
      explorerUrl={fujiTxUrl(tx.data)}
      preSentHash={preSentHash}
      preSentUrl={preSentUrl}
      onConnect={() => connectors[0] !== undefined && connect.mutate({ connector: connectors[0] })}
      onSwitch={() => switcher.mutate({ chainId: FUJI_CHAIN_ID })}
      onSend={() => address !== undefined && tx.mutate({ ...buildFirstTx(address), chainId: FUJI_CHAIN_ID })}
    />
  );
}
