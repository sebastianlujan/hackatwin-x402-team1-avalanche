import type { Address, Hex } from '@hackatwin/core';
import { describe, expect, it } from 'vitest';
import { ClientLogReader, type RawLog } from '../../adapters/log-reader.ts';

const router = `0x${'a'.repeat(40)}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const raw = (n: number): RawLog => ({
  address: router,
  topics: [hash(n)],
  data: '0x',
  transactionHash: hash(n),
  blockNumber: BigInt(n),
  logIndex: n,
});

describe('ClientLogReader', () => {
  it('reads the whole history of the addresses and maps the fields', async () => {
    const calls: unknown[] = [];
    const reader = new ClientLogReader({
      31337: {
        async getLogs(args) {
          calls.push(args);
          return [raw(1), raw(2)];
        },
      },
    });
    const logs = await reader.logs(31337, [router]);
    expect(calls).toEqual([{ address: [router], fromBlock: 'earliest', toBlock: 'latest' }]);
    expect(logs[1]).toEqual({
      address: router,
      topics: [hash(2)],
      data: '0x',
      txHash: hash(2),
      blockNumber: 2n,
      logIndex: 2,
    });
  });

  it('skips pending logs that have no hash, block or index', async () => {
    const pending = { ...raw(3), transactionHash: null, blockNumber: null, logIndex: null };
    const reader = new ClientLogReader({ 31337: { getLogs: async () => [pending, raw(1)] } });
    expect(await reader.logs(31337, [router])).toHaveLength(1);
  });

  it('refuses a chain it has no source for, naming the chain ID', async () => {
    await expect(new ClientLogReader({}).logs(1, [router])).rejects.toThrow('chain ID 1');
  });
});
