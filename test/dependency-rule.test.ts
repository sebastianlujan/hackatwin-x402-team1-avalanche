import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkDependencyRule,
  extractSpecifiers,
  formatViolation,
  type Manifest,
  readSnapshot,
  type Snapshot,
} from './dependency-rule.ts';

const names: Record<string, string> = {
  'packages/core': '@hackatwin/core',
  'packages/config': '@hackatwin/config',
  'packages/pricing': '@hackatwin/pricing',
  'demos/01-x402-twin': '@hackatwin/demo-01-x402-twin',
  'demos/02-l1-crosschain': '@hackatwin/demo-02-l1-crosschain',
  'demos/03-agentic-crosschain-commerce': '@hackatwin/demo-03-agentic-crosschain-commerce',
  'e2e/protocol': '@hackatwin/e2e-protocol',
};

const make = (files: Record<string, string> = {}, manifests: Record<string, Manifest> = {}): Snapshot => ({
  manifests: {
    ...Object.fromEntries(Object.entries(names).map(([dir, name]) => [`${dir}/package.json`, { name }])),
    ...manifests,
  },
  files: { 'packages/core/src/index.ts': 'export {};', ...files },
});

const rules = (snapshot: Snapshot): string[] => checkDependencyRule(snapshot).map((v) => v.rule);
const demo3 = 'demos/03-agentic-crosschain-commerce/main.ts';

describe('real repo', () => {
  it('has no violations', () => {
    const violations = checkDependencyRule(readSnapshot(join(import.meta.dirname, '..')));
    expect(violations.map(formatViolation)).toEqual([]);
  });
});

describe('extractSpecifiers', () => {
  it('finds every import form, type-only included', () => {
    const source = [
      "import a from 'a';",
      "import type { B } from 'b';",
      "export * from 'c';",
      "export { d } from 'd';",
      "import 'e';",
      "const f = await import('f');",
      "const g = require('g');",
      "export const h = 'not-a-specifier';",
    ].join('\n');
    expect(extractSpecifiers(source).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});

describe('dependency rule', () => {
  it('accepts a clean snapshot', () => {
    expect(rules(make())).toEqual([]);
  });

  it('R1 fails when core gains a dependency and names it', () => {
    const snapshot = make(
      {},
      { 'packages/core/package.json': { name: '@hackatwin/core', dependencies: { zod: '1' } } },
    );
    const [violation] = checkDependencyRule(snapshot);
    expect(rules(snapshot)).toEqual(['R1']);
    expect(formatViolation(violation as never)).toBe('R1 packages/core/package.json: zod: core declares dependencies');
  });

  it('R1 fails on peer and optional dependencies and on non-test imports, not test imports', () => {
    const manifests = {
      'packages/core/package.json': { name: 'c', peerDependencies: { a: '1' }, optionalDependencies: { b: '1' } },
    };
    expect(rules(make({}, manifests))).toEqual(['R1', 'R1']);
    expect(rules(make({ 'packages/core/src/x.ts': "import { z } from 'zod';" }))).toEqual(['R1']);
    expect(rules(make({ 'packages/core/src/x.test.ts': "import { it } from 'vitest';" }))).toEqual([]);
  });

  it('R2 fails when a package imports or depends on a demo', () => {
    const forbidden = { 'packages/pricing/src/x.ts': "import { m } from '@hackatwin/demo-01-x402-twin/module';" };
    const [violation] = checkDependencyRule(make(forbidden));
    expect(formatViolation(violation as never)).toContain(
      'R2 packages/pricing/src/x.ts: @hackatwin/demo-01-x402-twin/module',
    );
    const relative = { 'packages/pricing/src/x.ts': "import { m } from '../../../demos/01-x402-twin/module.ts';" };
    expect(rules(make(relative))).toEqual(['R2']);
    const manifest = {
      'packages/pricing/package.json': { name: 'p', dependencies: { '@hackatwin/demo-01-x402-twin': '1' } },
    };
    expect(rules(make({}, manifest))).toEqual(['R2']);
  });

  it('R3 allows Demo 3 to import module only', () => {
    const allowed = { [demo3]: "import { m } from '@hackatwin/demo-01-x402-twin/module';" };
    expect(rules(make(allowed))).toEqual([]);
    const deep = { [demo3]: "import { x } from '@hackatwin/demo-01-x402-twin/adapters/x';" };
    expect(rules(make(deep))).toEqual(['R3']);
  });

  it('R3 fails when another demo or an e2e deep import references a demo', () => {
    const cross = { 'demos/01-x402-twin/module.ts': "import { m } from '@hackatwin/demo-02-l1-crosschain/module';" };
    expect(rules(make(cross))).toEqual(['R3']);
    const own = { 'demos/01-x402-twin/module.ts': "import { m } from '@hackatwin/demo-01-x402-twin/module';" };
    expect(rules(make(own))).toEqual([]);
    const e2e = { 'e2e/protocol/src/a.ts': "import { m } from '@hackatwin/demo-01-x402-twin/adapters/x';" };
    expect(rules(make(e2e))).toEqual(['R3']);
    const manifest = {
      'demos/01-x402-twin/package.json': { name: 'd1', dependencies: { '@hackatwin/demo-02-l1-crosschain': '1' } },
    };
    expect(rules(make({}, manifest))).toEqual(['R3']);
  });

  it('R4 fails when a relative import leaves its workspace, including the Demo 3 shortcut', () => {
    const shortcut = { [demo3]: "import { m } from '../01-x402-twin/module.ts';" };
    expect(rules(make(shortcut))).toEqual(['R4']);
    const inside = { 'packages/pricing/src/a.ts': "import { b } from './b.ts';" };
    expect(rules(make(inside))).toEqual([]);
  });

  it('R5 fails when production code imports the test fakes', () => {
    const production = { 'packages/config/src/x.ts': "import { F } from '@hackatwin/core/testing';" };
    expect(rules(make(production))).toEqual(['R5']);
    const test = { 'packages/config/src/x.test.ts': "import { F } from '@hackatwin/core/testing';" };
    expect(rules(make(test))).toEqual([]);
    const e2e = { 'e2e/protocol/src/x.ts': "import { F } from '@hackatwin/core/testing';" };
    expect(rules(make(e2e))).toEqual([]);
  });

  it('R6 fails when process.env or process is read outside the loader', () => {
    expect(rules(make({ 'packages/pricing/src/x.ts': 'const k = process.env.KEY;' }))).toEqual(['R6']);
    expect(rules(make({ 'packages/pricing/src/x.ts': "const k = process['env'];" }))).toEqual(['R6']);
    expect(rules(make({ 'packages/pricing/src/x.ts': "import { env } from 'node:process';" }))).toEqual(['R6']);
    expect(rules(make({ 'packages/pricing/src/x.ts': "import process from 'process';" }))).toEqual(['R6']);
    const loader = { 'packages/config/src/load-profile.ts': 'export const e = process.env;' };
    expect(rules(make(loader))).toEqual([]);
  });

  it('R7 fails when a package imports the keystore, not when a root does', () => {
    const subpath = {
      'packages/pricing/src/x.ts': "import { loadKeystoreAccount } from '@hackatwin/chains/keystore';",
    };
    expect(rules(make(subpath))).toEqual(['R7']);
    const relative = { 'packages/chains/src/x.ts': "import { loadKeystoreAccount } from './keystore/index.ts';" };
    expect(rules(make(relative, { 'packages/chains/package.json': { name: '@hackatwin/chains' } }))).toEqual(['R7']);
    const inside = { 'packages/chains/src/keystore/a.ts': "import { b } from './b.ts';" };
    expect(rules(make(inside, { 'packages/chains/package.json': { name: '@hackatwin/chains' } }))).toEqual([]);
    const root = {
      'demos/01-x402-twin/scripts/run.ts': "import { loadKeystoreAccount } from '@hackatwin/chains/keystore';",
    };
    expect(rules(make(root))).toEqual([]);
  });

  it('ignores files outside any workspace', () => {
    expect(rules(make({ 'apps/stray/x.ts': 'const k = process.env.KEY;' }))).toEqual([]);
  });
});
