import { startLocalAnvil } from '@hackatwin/chains';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCAL_HUB, LOCAL_L1 } from './anvils.ts';
import { runSpike, type SpikeReport } from './spike-teleporter.ts';
import { CANONICAL_TELEPORTER } from './teleporter.ts';

const pids: number[] = [];
let report: SpikeReport;

beforeAll(async () => {
  for (const chain of [LOCAL_HUB, LOCAL_L1]) pids.push((await startLocalAnvil({ chain })).pid);
  report = await runSpike(LOCAL_HUB, LOCAL_L1);
});

afterAll(() => {
  for (const pid of pids) process.kill(pid, 'SIGTERM');
});

describe('Teleporter placement spike', () => {
  it('places Teleporter at the canonical address with code on both chains', () => {
    expect(CANONICAL_TELEPORTER).toBe('0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf');
    expect(report.winner).toBe('A');
    expect(report.address).toBe(CANONICAL_TELEPORTER);
    expect(report.codeSize.hub).toBeGreaterThan(0);
    expect(report.codeSize.l1).toBeGreaterThan(0);
  });

  it('tries the methods in order A, B, C and records each outcome', () => {
    expect(report.attempts.map((a) => a.method)).toEqual(['A']);
    expect(report.attempts[0]?.ok).toBe(true);
  });

  it('relays one message from the hub to the L1 Teleporter', () => {
    expect(report.roundTrip).toBe(true);
  });
});
