import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LOCAL_HUB, LOCAL_L1 } from '../../src/local/anvils.ts';
import { type ForgeFacts, forgeDir, writeForgeFiles } from '../../src/local/forge.ts';

const root = mkdtempSync(join(tmpdir(), 'forge-files-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as const;
const facts: ForgeFacts = {
  chains: { hub: LOCAL_HUB, l1: LOCAL_L1 },
  ids: { hub: `0x${'aa'.repeat(32)}`, l1: `0x${'bb'.repeat(32)}` },
  usdc: addr(1),
  router: addr(2),
  selector: 16015286601757825753n,
  home: addr(3),
  remote: addr(4),
  roles: {
    deployer: addr(10),
    receiverDeployer: addr(11),
    treasury: addr(12),
    agent: addr(13),
    merchant: addr(14),
    fallback: addr(15),
  },
};
const read = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

describe('Forge files', () => {
  it('Path: the directory sits under the instance cache and the instance name cannot escape it', () => {
    expect(forgeDir(root, 'dev')).toBe(join(root, '.cache/local-crosschain/dev/forge'));
    expect(() => forgeDir(root, '../dev')).toThrow('instance');
  });

  it('Source key: local-ccip carries the simulator selector as a decimal string', async () => {
    const dir = forgeDir(root, 'source');
    await writeForgeFiles(dir, facts);
    expect(read(dir, 'registry/local-ccip.json')).toMatchObject({
      key: 'local-ccip',
      ccip: { chainSelector: '16015286601757825753' },
    });
  });

  it('Registry: the scripts keys carry the local chain IDs, the router, the token and the ICTT pair', async () => {
    const dir = forgeDir(root, 'registry');
    await writeForgeFiles(dir, facts);
    expect(read(dir, 'registry/fuji.json')).toMatchObject({
      key: 'fuji',
      chainId: 31337,
      contracts: { usdc: { address: facts.usdc }, ccipRouter: { address: facts.router } },
      icm: { usdcTokenHome: facts.home, blockchainId: facts.ids.hub },
    });
    expect(read(dir, 'registry/twinpay-l1.json')).toMatchObject({
      key: 'twinpay-l1',
      chainId: 31338,
      icm: { usdcTokenRemote: facts.remote, blockchainId: facts.ids.l1 },
    });
  });

  it('Params: the receiver deployer is at nonce 0 and the agent is the only broker sender', async () => {
    const dir = forgeDir(root, 'params');
    await writeForgeFiles(dir, facts);
    expect(read(dir, 'params/fuji.json')).toMatchObject({
      deployer: facts.roles.deployer,
      receiverDeployer: facts.roles.receiverDeployer,
      receiverDeployerNonce: 0,
      fallbackRecipient: facts.roles.fallback,
      brokerPairs: [{ chain: 'local-ccip', sender: facts.roles.agent, payer: facts.roles.treasury }],
    });
    expect(read(dir, 'params/twinpay-l1.json')).toMatchObject({
      deployer: facts.roles.receiverDeployer,
      receiverDeployerNonce: 0,
      merchants: [facts.roles.merchant],
    });
  });

  it('Deployments: the directory exists and is empty so the scripts can write their records', async () => {
    const dir = forgeDir(root, 'deployments');
    await writeForgeFiles(dir, facts);
    expect(readFileSync(join(dir, 'deployments/.gitkeep'), 'utf8')).toBe('');
  });
});
