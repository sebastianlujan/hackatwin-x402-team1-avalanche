import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadKeystoreAccount } from '@hackatwin/chains/keystore';
import { describe, expect, it } from 'vitest';
import { ensureRoleKeystore, ensureStateDir, ROLES, writeDemoEnv, writeSecret } from './state.ts';

const mode = (path: string): number => statSync(path).mode & 0o777;
const fresh = (): string => {
  const dir = join(mkdtempSync(join(tmpdir(), 'demo1-')), '.demo1');
  ensureStateDir(dir);
  return dir;
};

describe('state dir and secrets', () => {
  it('creates the dir at 0700 and writes secrets at 0600 without overwriting', () => {
    const dir = fresh();
    expect(mode(dir)).toBe(0o700);
    const file = join(dir, 'secret');
    writeSecret(file, 'one');
    expect(mode(file)).toBe(0o600);
    expect(() => writeSecret(file, 'two')).toThrow(/EEXIST/);
    expect(readFileSync(file, 'utf8')).toBe('one');
  });
});

describe('ensureRoleKeystore', () => {
  it('creates a keystore and a 0600 password file that load back to the same address', () => {
    const dir = fresh();
    const result = ensureRoleKeystore(dir, 'agent');
    expect(result).toMatchObject({ role: 'agent', name: 'agent', created: true });
    expect([mode(join(dir, 'agent')), mode(result.passwordFile)]).toEqual([0o600, 0o600]);
    expect(loadKeystoreAccount('agent', result.passwordFile, dir).address).toBe(result.address);
  });

  it('keeps an existing keystore and its address on a rerun', () => {
    const dir = fresh();
    const first = ensureRoleKeystore(dir, 'seller');
    const second = ensureRoleKeystore(dir, 'seller');
    expect(second).toMatchObject({ address: first.address, created: false });
  });

  it('fails when the password file is missing', () => {
    const dir = fresh();
    writeSecret(join(dir, 'agent'), '{}');
    expect(() => ensureRoleKeystore(dir, 'agent')).toThrow(/without its password file/);
  });
});

describe('writeDemoEnv', () => {
  it('lists non-secret variables only: no 64-hex value anywhere in the state', () => {
    const dir = fresh();
    const keystores = ROLES.map((role) => ensureRoleKeystore(dir, role));
    const env = readFileSync(writeDemoEnv(dir, 'http://127.0.0.1:8545', keystores), 'utf8');
    expect(env).toContain(`KEYSTORE_DIR=${dir}`);
    expect(env).toContain('FACILITATOR_KEYSTORE=facilitator');
    expect(env).toContain(`SELLER_KEYSTORE_PASSWORD_FILE=${join(dir, 'seller.password')}`);
    expect(env).not.toMatch(/[0-9a-fA-F]{64}/);
    expect(JSON.stringify(keystores)).not.toMatch(/[0-9a-fA-F]{64}/);
  });
});
