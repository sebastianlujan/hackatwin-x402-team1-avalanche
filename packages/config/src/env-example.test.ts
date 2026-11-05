import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENV_VARIABLES } from './env.ts';

const lines = readFileSync(resolve(import.meta.dirname, '../../../.env.example'), 'utf8').split('\n');
const entries = lines.filter((line) => line.trim() !== '' && !line.startsWith('#'));

describe('.env.example', () => {
  it('lists every schema variable with an empty value', () => {
    expect(entries.every((line) => /^[A-Z0-9_]+=$/.test(line))).toBe(true);
    expect(entries.map((line) => line.slice(0, -1)).sort()).toEqual([...ENV_VARIABLES].sort());
  });

  it('lists both local profile keys with empty values', () => {
    expect(entries).toEqual(expect.arrayContaining(['LOCAL_HUB_RPC_URL=', 'LOCAL_L1_RPC_URL=']));
  });

  it('puts a default comment above each registry RPC variable', () => {
    const rpc = ['CCHAIN', 'FUJI', 'SEPOLIA', 'TWINPAY_L1', 'ARBITRUM', 'BASE'].map((key) => `${key}_RPC_URL=`);
    for (const entry of rpc) expect(lines[lines.indexOf(entry) - 1]).toMatch(/^# default: \S+|^# default: none/);
  });
});
