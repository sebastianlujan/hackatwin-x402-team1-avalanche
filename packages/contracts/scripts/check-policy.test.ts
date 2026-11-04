import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkPolicy, isExactPin } from './check-policy.ts';

const here = dirname(fileURLToPath(import.meta.url));
const cleanups: string[] = [];

const WORKSPACE = `packages:
  - packages/*

catalog:
  '@openzeppelin/contracts': 5.7.0
  '@openzeppelin/contracts-5.3.0': npm:@openzeppelin/contracts@5.3.0
  forge-std: github:foundry-rs/forge-std#v1.9.4
  floating: ^1.2.3
`;

const GOOD_PKG = { name: 'x', scripts: { test: 'forge test' }, devDependencies: { 'forge-std': 'catalog:' } };
const PRAGMA = '// SPDX-License-Identifier: MIT\npragma solidity 0.8.30;\n';

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'policy-'));
  cleanups.push(root);
  const base = { 'pnpm-workspace.yaml': WORKSPACE, 'pkg/package.json': JSON.stringify(GOOD_PKG), ...files };
  for (const [path, body] of Object.entries(base)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return { packageDir: join(root, 'pkg'), workspaceFile: join(root, 'pnpm-workspace.yaml'), root };
}

afterEach(() => {
  for (const dir of cleanups.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('isExactPin', () => {
  it.each(['5.7.0', '1.0.0-rc.1', 'npm:@openzeppelin/contracts@4.8.3', 'github:foundry-rs/forge-std#v1.9.4'])(
    'accepts %s',
    (spec) => expect(isExactPin(spec)).toBe(true),
  );

  it.each([
    '^5.7.0',
    '~1.2.3',
    '>=1.0.0',
    '*',
    'latest',
    '5',
    'npm:pkg@^1.0.0',
    'github:org/repo#main',
    'github:org/repo',
  ])('rejects %s', (spec) => expect(isExactPin(spec)).toBe(false));
});

describe('checkPolicy', () => {
  it('passes a clean package with catalog pins', () => {
    expect(checkPolicy(fixture({ 'pkg/src/A.sol': PRAGMA }))).toEqual([]);
  });

  it('rejects a floating version written in package.json', () => {
    const pkg = { ...GOOD_PKG, devDependencies: { 'forge-std': '^1.9.4' } };
    const found = checkPolicy(fixture({ 'pkg/package.json': JSON.stringify(pkg) }));
    expect(found.map((v) => v.rule)).toEqual(['pin']);
    expect(found[0]?.message).toContain('forge-std');
  });

  it('rejects a catalog entry that floats', () => {
    const pkg = { ...GOOD_PKG, devDependencies: { floating: 'catalog:' } };
    const found = checkPolicy(fixture({ 'pkg/package.json': JSON.stringify(pkg) }));
    expect(found.map((v) => v.rule)).toEqual(['pin']);
  });

  it('rejects a catalog reference with no entry', () => {
    const pkg = { ...GOOD_PKG, devDependencies: { missing: 'catalog:' } };
    const found = checkPolicy(fixture({ 'pkg/package.json': JSON.stringify(pkg) }));
    expect(found[0]?.message).toContain('missing');
  });

  it('rejects submodules and a lib directory', () => {
    const found = checkPolicy(fixture({ 'pkg/.gitmodules': '', 'pkg/lib/forge-std/x.txt': 'x' }));
    expect(found.map((v) => v.rule)).toEqual(['submodule', 'submodule']);
  });

  it('rejects hooks, workflows, commitlint and a mainnet deploy script inside the package', () => {
    const pkg = { ...GOOD_PKG, scripts: { 'deploy:mainnet': 'forge script' } };
    const found = checkPolicy(
      fixture({
        'pkg/package.json': JSON.stringify(pkg),
        'pkg/.husky/pre-commit': 'x',
        'pkg/.github/workflows/ci.yml': 'x',
        'pkg/commitlint.config.js': 'x',
      }),
    );
    expect(found.filter((v) => v.rule === 'root-only')).toHaveLength(4);
  });

  it.each([
    ['--broadcast', 'forge script script/D.s.sol --broadcast'],
    ['--private-key', 'forge script --private-key 0xabc'],
    ['PRIVATE_KEY', 'PRIVATE_KEY=0xabc'],
    ['key material', `signerKey = 0x${'ab'.repeat(32)}`],
    ['credentialed URL', 'rpc = https://user:hunter2@rpc.example.com/v1'],
    ['api key URL', 'rpc = https://rpc.example.com/v1?apikey=abc123'],
  ])('flags %s', (_name, line) => {
    const found = checkPolicy(fixture({ 'pkg/foundry.toml': line }));
    expect(found.map((v) => v.rule)).toEqual(['secret']);
  });

  it('allows environment references and plain bytes32 values', () => {
    const body = `fuji = '\${FUJI_RPC_URL}'\nid = 0x${'ab'.repeat(32)}\nrpc = https://\${USER}:\${PASS}@host.example\n`;
    expect(checkPolicy(fixture({ 'pkg/foundry.toml': body }))).toEqual([]);
  });

  it('skips build output and dependencies', () => {
    const found = checkPolicy(fixture({ 'pkg/out/x.json': '--broadcast', 'pkg/node_modules/a/b.sol': 'x' }));
    expect(found).toEqual([]);
  });

  it('requires the exact pragma in every solidity file', () => {
    const found = checkPolicy(
      fixture({
        'pkg/src/Good.sol': PRAGMA,
        'pkg/src/Caret.sol': 'pragma solidity ^0.8.30;\n',
        'pkg/test/Missing.t.sol': 'contract T {}\n',
      }),
    );
    expect(found.map((v) => [v.rule, v.file])).toEqual([
      ['pragma', 'src/Caret.sol'],
      ['pragma', 'test/Missing.t.sol'],
    ]);
  });
});

describe('contracts:policy command', () => {
  const script = resolve(here, 'check-policy.ts');

  it('exits non-zero on a dirty fixture and names the violation', () => {
    const { packageDir, workspaceFile } = fixture({ 'pkg/foundry.toml': 'cmd = forge script --broadcast' });
    const run = spawnSync('node', [script, packageDir, workspaceFile], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('secret');
  });

  it('passes on the real package', () => {
    const run = spawnSync('node', [script], { encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });
});
