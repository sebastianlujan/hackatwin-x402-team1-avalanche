import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const api = join(import.meta.dirname, '../src/app/api');
const listing = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listing(join(dir, e.name)).map((f) => `${e.name}/${f}`) : [e.name],
  );

describe('api routes', () => {
  it('are exactly the three run routes, with no Fuji route', () => {
    expect(listing(api).sort()).toEqual(['runs/[id]/events/route.ts', 'runs/[id]/route.ts', 'runs/route.ts']);
  });

  it.each([
    ['runs/route.ts', 'POST'],
    ['runs/[id]/route.ts', 'GET'],
    ['runs/[id]/events/route.ts', 'GET'],
  ])('%s runs on nodejs, dynamic, and exports %s', async (file, method) => {
    const route = (await import(join(api, file))) as Record<string, unknown>;
    expect(route.runtime).toBe('nodejs');
    expect(route.dynamic).toBe('force-dynamic');
    expect(typeof route[method]).toBe('function');
  });
});
