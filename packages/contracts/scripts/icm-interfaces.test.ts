import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'interfaces', 'external', 'icm');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const SOURCES = ['IERC20SendAndCallReceiver.sol', 'IERC20TokenTransferrer.sol'];

describe('icm interfaces directory', () => {
  it('holds only the two interface files and the provenance note', () => {
    expect(readdirSync(dir).sort()).toEqual([...SOURCES, 'PROVENANCE.md']);
  });

  it('declares exactly the receiver, the transferrer and the struct', () => {
    const declared = SOURCES.flatMap((name) =>
      [...read(name).matchAll(/^(interface|struct|library|contract|enum)\s+(\w+)/gm)].map((m) => `${m[1]} ${m[2]}`),
    );
    expect(declared.sort()).toEqual([
      'interface IERC20SendAndCallReceiver',
      'interface IERC20TokenTransferrer',
      'struct SendAndCallInput',
    ]);
  });

  it('exposes only sendAndCall on the transferrer', () => {
    const functions = [...read('IERC20TokenTransferrer.sol').matchAll(/function\s+(\w+)/g)].map((m) => m[1]);
    expect(functions).toEqual(['sendAndCall']);
  });

  it.each(SOURCES)('%s is MIT and pinned to 0.8.30', (name) => {
    const text = read(name);
    expect(text).toMatch(/^\/\/ SPDX-License-Identifier: MIT$/m);
    expect(text).toMatch(/^pragma solidity 0\.8\.30;$/m);
  });

  it('records the upstream repository, a commit hash and the original-MIT statement', () => {
    const note = read('PROVENANCE.md');
    expect(note).toContain('ava-labs/icm-services');
    expect(note).toMatch(/\b[0-9a-f]{40}\b/);
    expect(note).toMatch(/original MIT/i);
  });
});
