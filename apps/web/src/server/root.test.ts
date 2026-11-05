import { afterEach, describe, expect, it, vi } from 'vitest';

describe('server root', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    const root = await import('./root.ts');
    expect(root.describeRoot()).toBe('web-root');
    expect(reads).toEqual([]);
  });
});
