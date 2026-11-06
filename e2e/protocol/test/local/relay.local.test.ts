import { createGuardedClients, type GuardedClients, startLocalAnvil } from '@hackatwin/chains';
import type { Hex } from 'viem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCAL_HUB, LOCAL_L1 } from '../../src/local/anvils.ts';
import { messageReceived, receiveEvent, relayOnce, sendMessage } from '../../src/local/relay.ts';
import { deployInfra, type Infra } from '../../src/local/world.ts';

const pids: number[] = [];
let infra: Infra;
let hub: GuardedClients;
let l1: GuardedClients;

const OTHER_RELAYER = '0x000000000000000000000000000000000000dEaD';

beforeAll(async () => {
  for (const chain of [LOCAL_HUB, LOCAL_L1]) pids.push((await startLocalAnvil({ chain })).pid);
  infra = await deployInfra(LOCAL_HUB, LOCAL_L1);
  hub = await createGuardedClients({ chain: LOCAL_HUB, rpcUrl: LOCAL_HUB.rpcUrl });
  l1 = await createGuardedClients({ chain: LOCAL_L1, rpcUrl: LOCAL_L1.rpcUrl });
});

afterAll(() => {
  for (const pid of pids) process.kill(pid, 'SIGTERM');
});

const relay = () => relayOnce({ hub: LOCAL_HUB, l1: LOCAL_L1 }, infra.ids);

async function receivedSource(c: GuardedClients, messageID: Hex): Promise<Hex | undefined> {
  const [log] = await c.public.getLogs({ event: receiveEvent, args: { messageID }, fromBlock: 'earliest' });
  return log?.args.sourceBlockchainID;
}

describe('ICM relay simulator', () => {
  it('Hub to L1: the L1 Teleporter receives it with the hub blockchain ID as source', async () => {
    const id = await sendMessage(hub, infra.ids.l1);
    expect(await messageReceived(l1, id)).toBe(false);
    const report = await relay();
    expect(report.delivered).toContain(id);
    expect(await messageReceived(l1, id)).toBe(true);
    expect(await receivedSource(l1, id)).toBe(infra.ids.hub);
  });

  it('L1 to hub: the hub Teleporter receives it with the L1 blockchain ID as source', async () => {
    const id = await sendMessage(l1, infra.ids.hub);
    const report = await relay();
    expect(report.delivered).toContain(id);
    expect(await messageReceived(hub, id)).toBe(true);
    expect(await receivedSource(hub, id)).toBe(infra.ids.l1);
  });

  it('No double delivery: a second run sends no delivery transaction', async () => {
    const id = await sendMessage(hub, infra.ids.l1);
    expect((await relay()).delivered).toContain(id);
    const before = await l1.public.getBlockNumber();
    const again = await relay();
    expect(again.delivered).toEqual([]);
    expect(again.skipped).toContain(id);
    expect(await l1.public.getBlockNumber()).toBe(before);
  });

  it('Delivery reverts: the failure carries the message ID and the message stays undelivered', async () => {
    const id = await sendMessage(hub, infra.ids.l1, [OTHER_RELAYER]);
    const report = await relay();
    expect(report.delivered).not.toContain(id);
    const failure = report.failed.find((f) => f.messageId === id);
    expect(failure?.reason).toContain('unauthorized relayer');
    expect(await messageReceived(l1, id)).toBe(false);
    expect((await relay()).failed.map((f) => f.messageId)).toContain(id);
  });
});
