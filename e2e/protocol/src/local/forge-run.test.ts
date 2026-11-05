import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LocalChain } from '@hackatwin/chains';
import { describe, expect, it, vi } from 'vitest';
import { LOCAL_HUB } from './anvils.ts';
import { type ForgeRunner, type ForgeScriptOptions, forgeScriptArgs, runForgeScript } from './forge.ts';

const sender = '0x000000000000000000000000000000000000dEaD';
const target = 'script/DeployFuji.s.sol:DeployFuji';
const remote: LocalChain = { ...LOCAL_HUB, rpcUrl: 'https://rpc.example.org:8545' };

const setup = (chain: LocalChain = LOCAL_HUB, probe: () => Promise<void> = async () => {}) => {
  const calls: string[] = [];
  const run: ForgeRunner = vi.fn(async () => {
    calls.push('run');
  });
  const probeFn = vi.fn(async () => {
    calls.push('probe');
    await probe();
  });
  const options: ForgeScriptOptions = {
    chain,
    target,
    sender,
    forgeDir: '/abs/forge',
    contractsDir: '/abs/contracts',
    run,
    probe: probeFn,
  };
  return { calls, run, probe: probeFn, options };
};

describe('Forge script run', () => {
  it('Local unlocked sender: the arguments are fixed and name the sender, the RPC and the broadcast', () => {
    expect(forgeScriptArgs(target, LOCAL_HUB.rpcUrl, sender)).toEqual([
      'script',
      target,
      '--rpc-url',
      LOCAL_HUB.rpcUrl,
      '--broadcast',
      '--unlocked',
      '--sender',
      sender,
    ]);
  });

  it('No private key: no key, keystore or mnemonic flag appears in the arguments', () => {
    const joined = forgeScriptArgs(target, LOCAL_HUB.rpcUrl, sender).join(' ');
    expect(joined).not.toMatch(/private-key|mnemonic|--account|keystore|ledger/i);
  });

  it('No private key: no setup source file names the flag', () => {
    const files = readdirSync(import.meta.dirname).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'));
    expect(files).toContain('forge.ts');
    for (const name of files)
      expect(readFileSync(join(import.meta.dirname, name), 'utf8')).not.toContain('--private-key');
  });

  it('Probe first: the loopback probe runs before forge, which runs once in the contracts directory', async () => {
    const { calls, run, options } = setup();
    await runForgeScript(options);
    expect(calls).toEqual(['probe', 'run']);
    const [command, args, spawnOptions] = vi.mocked(run).mock.calls[0] ?? [];
    expect(command).toBe('forge');
    expect(args).toEqual(forgeScriptArgs(target, LOCAL_HUB.rpcUrl, sender));
    expect(spawnOptions?.cwd).toBe('/abs/contracts');
  });

  it('Environment: the script reads the cache directories and no parent secret reaches forge', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-secret');
    const { run, options } = setup();
    await runForgeScript(options);
    vi.unstubAllEnvs();
    const env = vi.mocked(run).mock.calls[0]?.[2].env;
    expect(env).toMatchObject({
      DEPLOY_PARAMS_DIR: '/abs/forge/params',
      DEPLOY_DEPLOYMENTS_DIR: '/abs/forge/deployments',
      CHAIN_REGISTRY_DIR: '/abs/forge/registry',
    });
    expect(env?.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('Unlocked on a remote host: refused before the probe and before forge', async () => {
    const { run, probe, options } = setup(remote);
    await expect(runForgeScript(options)).rejects.toThrow('not loopback');
    expect(probe).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('Probe failure: a chain that is not the expected anvil never reaches forge', async () => {
    const { run, options } = setup(LOCAL_HUB, async () => {
      throw new Error('reports chain ID 43113');
    });
    await expect(runForgeScript(options)).rejects.toThrow('43113');
    expect(run).not.toHaveBeenCalled();
  });

  it('Sender: a value that is not an address is refused before the probe', async () => {
    const { run, probe, options } = setup();
    await expect(runForgeScript({ ...options, sender: '--private-key' as `0x${string}` })).rejects.toThrow('sender');
    expect(probe).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
