import type { Address } from '@hackatwin/core';
import { FakeChainClient, readKey } from '@hackatwin/core/testing';
import { describe, expect, it } from 'vitest';
import type { ChainsClient } from '../src/chain-client.ts';
import { chain } from '../src/registry.ts';
import { verifyRegistry } from '../src/verify-registry.ts';

class VerifyFake extends FakeChainClient implements ChainsClient {
  private readonly empty: ReadonlySet<string>;

  constructor(reads: Record<string, unknown>, empty: string[] = []) {
    super({ blockNumber: 500n, reads });
    this.empty = new Set(empty);
  }

  async codeSize(address: Address): Promise<number> {
    return this.empty.has(address) ? 0 : 100;
  }
}

const feed = '0xaf992a6ad37b4878cF9c31f082B178860e268cE3' as Address;
const sequencer = '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433' as Address;
const baseReads = {
  [readKey(feed, 'description')]: 'ARS / USD',
  [readKey(feed, 'decimals')]: 8,
  [readKey(sequencer, 'description')]: 'L2 Sequencer Uptime Status Feed',
};
const base = [chain('base')];

describe('verifyRegistry', () => {
  it('prints one pass line per entry and is ok when all is healthy', async () => {
    const report = await verifyRegistry(base, async () => new VerifyFake(baseReads));
    expect(report.lines).toEqual([`PASS base arsUsdFeed ${feed}`, `PASS base sequencerFeed ${sequencer}`]);
    expect(report.ok).toBe(true);
  });

  it('skips the planned L1 without failing', async () => {
    const report = await verifyRegistry([chain('twinpay-l1'), ...base], async () => new VerifyFake(baseReads));
    expect(report.lines[0]).toBe('SKIP twinpay-l1 (planned, not deployed)');
    expect(report.ok).toBe(true);
  });

  it('fails a missing contract naming the chain and address', async () => {
    const report = await verifyRegistry(base, async () => new VerifyFake(baseReads, [feed]));
    expect(report.lines[0]).toBe(`FAIL base arsUsdFeed ${feed} (no code at this address)`);
    expect(report.ok).toBe(false);
  });

  it('reports every entry when one of many fails', async () => {
    const reads = { ...baseReads, [readKey(feed, 'decimals')]: 18 };
    const report = await verifyRegistry(base, async () => new VerifyFake(reads));
    expect(report.lines).toEqual([
      `FAIL base arsUsdFeed ${feed} (decimals returned 18, expected 8)`,
      `PASS base sequencerFeed ${sequencer}`,
    ]);
    expect(report.ok).toBe(false);
  });

  it('fails every entry of a chain whose RPC is down and never prints the URL', async () => {
    const down = async () => {
      throw new Error('connect ECONNREFUSED https://secret.example/key');
    };
    const report = await verifyRegistry(base, down);
    expect(report.lines.map((l) => l.split(' ').slice(0, 3).join(' '))).toEqual([
      'FAIL base arsUsdFeed',
      'FAIL base sequencerFeed',
    ]);
    expect(report.lines.join('\n')).not.toContain('secret');
    expect(report.ok).toBe(false);
  });

  it('fails every entry when the block number or a read rejects', async () => {
    class NoBlock extends VerifyFake {
      override async blockNumber(): Promise<bigint> {
        throw new Error('down');
      }
    }
    expect(
      (await verifyRegistry(base, async () => new NoBlock(baseReads))).lines.every((l) => l.startsWith('FAIL')),
    ).toBe(true);
    const reads = { ...baseReads, [readKey(sequencer, 'description')]: new Error('boom') };
    const report = await verifyRegistry(base, async () => new VerifyFake(reads));
    expect(report.lines).toEqual([
      `PASS base arsUsdFeed ${feed}`,
      `FAIL base sequencerFeed ${sequencer} (call failed or RPC unreachable)`,
    ]);
  });

  it('keeps going after a chain fails and reads each chain at one block', async () => {
    const fake = new VerifyFake(baseReads);
    const report = await verifyRegistry([chain('arbitrum'), ...base], async (c) => {
      if (c.key === 'arbitrum') throw new Error('down');
      return fake;
    });
    expect(report.lines).toHaveLength(5);
    expect(new Set(fake.calls.map((c) => c.blockNumber))).toEqual(new Set([500n]));
  });

  it('resolves @name expectations and uint arguments', async () => {
    const { contracts } = chain('arbitrum') as Extract<ReturnType<typeof chain>, { status: 'live' }>;
    const [pool, argt, usdt0] = [contracts.curveArgtUsdt0Pool, contracts.argt, contracts.usdt0].map(
      (c) => c?.address as Address,
    );
    const reads = {
      [readKey(pool as Address, 'coins', [0n])]: (argt as string).toLowerCase(),
      [readKey(pool as Address, 'coins', [1n])]: usdt0,
      [readKey(argt as Address, 'symbol')]: 'ARGt',
      [readKey(usdt0 as Address, 'symbol')]: 'USD₮0',
    };
    const report = await verifyRegistry([chain('arbitrum')], async () => new VerifyFake(reads));
    expect(report.ok).toBe(true);
  });
});
