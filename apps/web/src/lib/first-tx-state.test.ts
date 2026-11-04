import { describe, expect, it } from 'vitest';
import { FIRST_TX_VALUE } from './first-tx.ts';
import { type FirstTxInput, firstTxState, isUserRejection } from './first-tx-state.ts';

const ready: FirstTxInput = { wallet: 'connected', chainId: 43113, balance: FIRST_TX_VALUE, send: 'idle' };
const state = (patch: Partial<FirstTxInput>) => firstTxState({ ...ready, ...patch });

describe('firstTxState', () => {
  it('is ready to send on Fuji with enough balance', () => {
    expect(state({})).toMatchObject({ phase: 'idle', canSend: true, canSwitch: false });
  });

  it.each([
    ['signing', false],
    ['pending', false],
    ['confirmed', true],
    ['rejected', true],
    ['failed', true],
  ] as const)('shows %s, with Send available again: %s', (send, canSend) => {
    expect(state({ send })).toMatchObject({ phase: send, canSend });
  });

  it('disables Send below 0.001 AVAX and says why', () => {
    expect(state({ balance: FIRST_TX_VALUE - 1n })).toMatchObject({ phase: 'no-balance', canSend: false });
  });

  it('waits for the balance before enabling Send', () => {
    expect(state({ balance: undefined })).toMatchObject({ phase: 'checking', canSend: false });
  });

  it.each([43114, 31337, 1])('offers a switch and disables Send on chain %i', (chainId) => {
    expect(state({ chainId })).toEqual({ phase: 'wrong-network', canSend: false, canSwitch: true, chainId });
  });

  it('shows an error and keeps Send disabled when the switch was rejected', () => {
    expect(state({ chainId: 43114, switchFailed: true })).toMatchObject({
      phase: 'switch-failed',
      canSend: false,
      canSwitch: true,
    });
  });

  it('handles a missing, unchecked or unconnected wallet without Send', () => {
    expect(state({ wallet: 'none' })).toMatchObject({ phase: 'no-wallet', canSend: false });
    expect(state({ wallet: 'checking' })).toMatchObject({ phase: 'checking', canSend: false });
    expect(state({ wallet: 'disconnected', chainId: undefined })).toMatchObject({ phase: 'connect', canSend: false });
  });

  it('never enables Send on a stale Fuji chain id when disconnected', () => {
    expect(state({ wallet: 'disconnected' }).canSend).toBe(false);
  });
});

describe('isUserRejection', () => {
  it('recognises viem and EIP-1193 rejections anywhere in the cause chain', () => {
    expect(isUserRejection({ name: 'UserRejectedRequestError' })).toBe(true);
    expect(isUserRejection({ code: 4001 })).toBe(true);
    expect(isUserRejection(Object.assign(new Error('outer'), { cause: { cause: { code: 4001 } } }))).toBe(true);
  });

  it('does not treat other errors as a rejection', () => {
    expect(isUserRejection(new Error('insufficient funds'))).toBe(false);
    expect(isUserRejection(undefined)).toBe(false);
    expect(isUserRejection('4001')).toBe(false);
  });
});
