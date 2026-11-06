import { afterEach, describe, expect, it, vi } from 'vitest';

describe('server root', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reads no environment variable on import', async () => {
    const reads: string[] = [];
    const env = new Proxy(
      {},
      {
        get: (_t, key) => {
          reads.push(String(key));
          return undefined;
        },
      },
    );
    vi.stubGlobal('process', { ...process, env });
    const root = await import('../../src/server/root.ts');
    expect(typeof root.openRun).toBe('function');
    expect(reads.filter((key) => /KEY|KEYSTORE|RPC|ANTHROPIC/.test(key))).toEqual([]);
  });

  it('reports the Claude key as missing only when ANTHROPIC_API_KEY is the gap', async () => {
    const { anthropicKeyAvailable } = await import('../../src/server/root.ts');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(anthropicKeyAvailable()).toBe(false);
  });
});
