import { describe, expect, it } from 'vitest';
import { abis } from '../abi/index.ts';

interface Item {
  type: string;
  name?: string;
  stateMutability?: string;
}

const broker = abis['src/PaymentBroker.sol:PaymentBroker'] as readonly Item[];
const writes = broker.filter((i) => i.type === 'function' && !['view', 'pure'].includes(i.stateMutability ?? ''));

describe('PaymentBroker ABI', () => {
  it('has only ccipReceive and the owner functions as state-changing entries', () => {
    expect(writes.map((i) => i.name).sort()).toEqual([
      'acceptOwnership',
      'ccipReceive',
      'renounceOwnership',
      'setAllowedSender',
      'transferOwnership',
    ]);
  });

  it('has no fallback or receive entry', () => {
    expect(broker.filter((i) => i.type === 'fallback' || i.type === 'receive')).toEqual([]);
  });
});
