import { startLocalAnvil } from '@hackatwin/chains';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDistinctChainIds, LOCAL_HUB, LOCAL_L1, probeChainId } from '../../src/local/anvils.ts';

const pids: number[] = [];

beforeAll(async () => {
  for (const chain of [LOCAL_HUB, LOCAL_L1]) pids.push((await startLocalAnvil({ chain })).pid);
});

afterAll(() => {
  for (const pid of pids) process.kill(pid, 'SIGTERM');
});

describe('two plain anvils', () => {
  it('report distinct chain IDs 31337 and 31338', async () => {
    assertDistinctChainIds(LOCAL_HUB, LOCAL_L1);
    expect([await probeChainId(LOCAL_HUB), await probeChainId(LOCAL_L1)]).toEqual([31337, 31338]);
  });
});
