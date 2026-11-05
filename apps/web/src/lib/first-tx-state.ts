import { FIRST_TX_VALUE, FUJI_CHAIN_ID } from './first-tx.ts';

export type FirstTxPhase =
  | 'checking'
  | 'no-wallet'
  | 'connect'
  | 'wrong-network'
  | 'switch-failed'
  | 'no-balance'
  | 'idle'
  | 'signing'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'failed';

export interface FirstTxInput {
  readonly wallet: 'checking' | 'none' | 'disconnected' | 'connected';
  readonly chainId?: number | undefined;
  // Wei; undefined while it loads.
  readonly balance?: bigint | undefined;
  readonly send: 'idle' | 'signing' | 'pending' | 'confirmed' | 'rejected' | 'failed';
  readonly switchFailed?: boolean | undefined;
}

export interface FirstTxState {
  readonly phase: FirstTxPhase;
  readonly canSend: boolean;
  readonly canSwitch: boolean;
  readonly chainId?: number | undefined;
}

const RESENDABLE = new Set<FirstTxPhase>(['idle', 'rejected', 'failed', 'confirmed']);

function phaseOf({ wallet, chainId, balance, send, switchFailed }: FirstTxInput): FirstTxPhase {
  if (wallet === 'checking') return 'checking';
  if (wallet === 'none') return 'no-wallet';
  if (wallet === 'disconnected') return 'connect';
  if (chainId !== FUJI_CHAIN_ID) return switchFailed === true ? 'switch-failed' : 'wrong-network';
  if (send !== 'idle') return send;
  if (balance === undefined) return 'checking';
  return balance < FIRST_TX_VALUE ? 'no-balance' : 'idle';
}

export function firstTxState(input: FirstTxInput): FirstTxState {
  const phase = phaseOf(input);
  const onFuji = input.wallet === 'connected' && input.chainId === FUJI_CHAIN_ID;
  return {
    phase,
    canSend: onFuji && RESENDABLE.has(phase) && (input.balance ?? 0n) >= FIRST_TX_VALUE,
    canSwitch: phase === 'wrong-network' || phase === 'switch-failed',
    ...(phase === 'wrong-network' || phase === 'switch-failed' ? { chainId: input.chainId } : {}),
  };
}

// A wallet refusal, by viem's error name or the EIP-1193 code, anywhere in the cause chain.
export function isUserRejection(error: unknown): boolean {
  for (let current = error, depth = 0; typeof current === 'object' && current !== null && depth < 6; depth++) {
    const { name, code, cause } = current as { name?: unknown; code?: unknown; cause?: unknown };
    if (name === 'UserRejectedRequestError' || code === 4001) return true;
    current = cause;
  }
  return false;
}
