import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildAbiModule, collectArtifacts, exportAbi } from './export-abi.ts';

const cleanups: string[] = [];

const TRANSFER = { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [], outputs: [] };
const SETTLE = { type: 'function', name: 'settle', stateMutability: 'nonpayable', inputs: [], outputs: [] };

function outDir(artifacts: { target: string; name: string; abi: unknown[] }[]) {
  const root = mkdtempSync(join(tmpdir(), 'abi-'));
  cleanups.push(root);
  const out = join(root, 'out');
  artifacts.forEach(({ target, name, abi }, index) => {
    const file = join(out, `${target.split('/').pop()}-${index}`, `${name}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ abi, metadata: { settings: { compilationTarget: { [target]: name } } } }));
  });
  return { root, out };
}

afterEach(() => {
  for (const dir of cleanups.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('collectArtifacts', () => {
  it('keeps only src artifacts and names each by its fully qualified path', () => {
    const { out } = outDir([
      { target: 'src/contracts/Hub.sol', name: 'Hub', abi: [SETTLE] },
      { target: 'test/Hub.t.sol', name: 'HubTest', abi: [TRANSFER] },
      { target: 'node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol', name: 'IERC20', abi: [TRANSFER] },
    ]);
    expect(collectArtifacts(out).map((a) => a.key)).toEqual(['src/contracts/Hub.sol:Hub']);
  });

  it('keeps two artifacts that share a name', () => {
    const { out } = outDir([
      { target: 'src/interfaces/IToken.sol', name: 'IToken', abi: [TRANSFER] },
      { target: 'src/interfaces/external/IToken.sol', name: 'IToken', abi: [SETTLE] },
    ]);
    expect(collectArtifacts(out).map((a) => a.key)).toEqual([
      'src/interfaces/IToken.sol:IToken',
      'src/interfaces/external/IToken.sol:IToken',
    ]);
  });
});

describe('buildAbiModule', () => {
  it('writes an as const object keyed by fully qualified name, sorted', () => {
    const text = buildAbiModule([
      { key: 'src/b/B.sol:B', abi: [SETTLE] },
      { key: 'src/a/A.sol:A', abi: [TRANSFER] },
    ]);
    expect(text).toContain('as const;');
    expect(text.indexOf('src/a/A.sol:A')).toBeLessThan(text.indexOf('src/b/B.sol:B'));
  });

  it('is identical for any input order', () => {
    const a = { key: 'src/a/A.sol:A', abi: [TRANSFER] };
    const b = { key: 'src/b/B.sol:B', abi: [SETTLE] };
    expect(buildAbiModule([a, b])).toBe(buildAbiModule([b, a]));
  });

  it('exports the literal ABI so names and types can be inferred', async () => {
    const { root } = outDir([]);
    const file = join(root, 'abis.ts');
    writeFileSync(file, buildAbiModule([{ key: 'src/a/A.sol:A', abi: [TRANSFER] }]));
    const mod = (await import(pathToFileURL(file).href)) as { abis: Record<string, { name: string }[]> };
    expect(mod.abis['src/a/A.sol:A']?.[0]?.name).toBe('transfer');
  });

  it('writes an empty object when there are no artifacts', () => {
    expect(buildAbiModule([])).toContain('export const abis = {} as const;');
  });
});

describe('exportAbi', () => {
  it('writes the module and rewriting changes nothing (drift check passes)', () => {
    const { root, out } = outDir([{ target: 'src/contracts/Hub.sol', name: 'Hub', abi: [SETTLE] }]);
    const dest = join(root, 'abi', 'generated', 'abis.ts');
    exportAbi(out, dest);
    const first = readFileSync(dest, 'utf8');
    exportAbi(out, dest);
    expect(readFileSync(dest, 'utf8')).toBe(first);
    expect(first).toContain('src/contracts/Hub.sol:Hub');
  });

  it('differs after an external signature changes (drift is detectable)', () => {
    const before = outDir([{ target: 'src/contracts/Hub.sol', name: 'Hub', abi: [SETTLE] }]);
    const after = outDir([{ target: 'src/contracts/Hub.sol', name: 'Hub', abi: [SETTLE, TRANSFER] }]);
    expect(buildAbiModule(collectArtifacts(before.out))).not.toBe(buildAbiModule(collectArtifacts(after.out)));
  });
});
