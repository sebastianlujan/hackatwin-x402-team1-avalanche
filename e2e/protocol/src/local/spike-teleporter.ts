import { createGuardedClients, type GuardedClients, type LocalChain } from '@hackatwin/chains';
import type { Address, Hex } from 'viem';
import { messageReceived, relayOnce, sendMessage } from './relay.ts';
import { CANONICAL_TELEPORTER } from './teleporter.ts';
import { deployInfra } from './world.ts';

export interface SpikeReport {
  attempts: { method: 'A' | 'B' | 'C'; ok: boolean; detail: string }[];
  winner?: 'A' | 'B' | 'C';
  address?: Address;
  codeSize: { hub: number; l1: number };
  roundTrip: boolean;
}

const codeSize = async (c: GuardedClients): Promise<number> =>
  ((await c.public.getCode({ address: CANONICAL_TELEPORTER })) ?? '0x').length / 2 - 1;

// Hub sends, the relay injects the exact stub bytes on the L1, and the L1 Teleporter marks the message received.
async function roundTrip(
  h: GuardedClients,
  l: GuardedClients,
  hub: LocalChain,
  l1: LocalChain,
  ids: { hub: Hex; l1: Hex },
) {
  const id = await sendMessage(h, ids.l1);
  await relayOnce({ hub, l1 }, ids);
  return messageReceived(l, id);
}

export async function runSpike(hub: LocalChain, l1: LocalChain): Promise<SpikeReport> {
  const report: SpikeReport = { attempts: [], codeSize: { hub: 0, l1: 0 }, roundTrip: false };
  let ids: { hub: Hex; l1: Hex };
  try {
    ({ ids } = await deployInfra(hub, l1));
    report.attempts.push({ method: 'A', ok: true, detail: 'impersonated v1 deployer at nonce 0' });
    report.winner = 'A';
    report.address = CANONICAL_TELEPORTER;
  } catch (error) {
    report.attempts.push({ method: 'A', ok: false, detail: String(error) });
    return report;
  }
  const h = await createGuardedClients({ chain: hub, rpcUrl: hub.rpcUrl });
  const l = await createGuardedClients({ chain: l1, rpcUrl: l1.rpcUrl });
  report.codeSize = { hub: await codeSize(h), l1: await codeSize(l) };
  report.roundTrip = await roundTrip(h, l, hub, l1, ids);
  return report;
}
