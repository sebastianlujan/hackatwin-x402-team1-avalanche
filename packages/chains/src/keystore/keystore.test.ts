import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateKeyToAddress } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { decryptKeystore } from './decrypt.ts';
import { encryptKeystore } from './encrypt.ts';
import { KeystoreError } from './keystore-error.ts';
import { loadKeystoreAccount } from './load-keystore-account.ts';

// The pbkdf2 vector is public, from the Web3 Secret Storage definition.
const KEY = '0x7a28b5ba57c53603b0b07b56bba752f7784bf506fa95edc395f5cf6c7514fe9d';
const PASSWORD = 'testpassword';
const pbkdf2 = {
  crypto: {
    cipher: 'aes-128-ctr',
    cipherparams: { iv: '6087dab2f9fdbbfaddc31a909735c1e6' },
    ciphertext: '5318b4d5bcd28de64ee5559e671353e16f075ecae9f99c7a79a38af5f869aa46',
    kdf: 'pbkdf2',
    kdfparams: {
      c: 262144,
      dklen: 32,
      prf: 'hmac-sha256',
      salt: 'ae3cd4e7013836a3df6bd7241b12db061dbe2c6785853cce422d148a624ce0bd',
    },
    mac: '517ead924a9d0dc3124507e3393d175ce3ff7c1e96529c6c555ce9e51205e9b2',
  },
  id: '3198bc9c-6672-5ab3-d995-4942343ae5b6',
  version: 3,
};
// Generated with `cast wallet import` from the public key above (scrypt, N=8192, r=8, p=1).
const scrypt = {
  crypto: {
    cipher: 'aes-128-ctr',
    cipherparams: { iv: '4da69a10b6954367d08ee6f588dddf4c' },
    ciphertext: 'b30ef2af91a5ac91af1ce91c66ac590e94052e8ac18e01517970b48afac78dab',
    kdf: 'scrypt',
    kdfparams: {
      dklen: 32,
      n: 8192,
      p: 1,
      r: 8,
      salt: 'efb6ea5f9683a4f33181a35e2408a2499e29978f001460b2ec711472ac5cc293',
    },
    mac: '9349b224c92a5a16c35c53f70a6b7e63db94096c12c1a6a7978344f1b15fa0ae',
  },
  id: 'fb89f966-f452-4e68-936a-7a9b718e66e5',
  version: 3,
};
// The published scrypt vector uses r=1 with N=262144, which OpenSSL rejects (N must be below 2^(16r)).
const publishedScrypt = {
  ...pbkdf2,
  crypto: { ...pbkdf2.crypto, kdf: 'scrypt', kdfparams: { dklen: 32, n: 262144, r: 1, p: 8, salt: 'ab0c7876' } },
};

describe('decryptKeystore', () => {
  it.each([
    ['pbkdf2', pbkdf2],
    ['scrypt', scrypt],
  ])('decrypts the public %s vector to the known key', (_, vector) => {
    expect(decryptKeystore('vector', vector, PASSWORD)).toBe(KEY);
  });

  it('throws a KeystoreError naming the keystore and not the password', () => {
    const wrong = 'hunter2-not-the-password';
    expect(() => decryptKeystore('deployer', pbkdf2, wrong)).toThrow(KeystoreError);
    expect(() => decryptKeystore('deployer', pbkdf2, wrong)).toThrow('keystore "deployer": wrong password');
    expect(() => decryptKeystore('deployer', pbkdf2, wrong)).not.toThrow(/hunter2/);
  });

  it('rejects an unsupported version, cipher, kdf and bad parameters', () => {
    const crypto = pbkdf2.crypto;
    expect(() => decryptKeystore('k', { ...pbkdf2, version: 2 }, PASSWORD)).toThrow(/version 3/);
    expect(() => decryptKeystore('k', { ...pbkdf2, crypto: { ...crypto, cipher: 'aes-256-cbc' } }, PASSWORD)).toThrow(
      /unsupported cipher/,
    );
    expect(() => decryptKeystore('k', { ...pbkdf2, crypto: { ...crypto, kdf: 'argon2' } }, PASSWORD)).toThrow(
      /unsupported kdf/,
    );
    const bad = { ...crypto, kdfparams: { ...crypto.kdfparams, c: 0 } };
    expect(() => decryptKeystore('k', { ...pbkdf2, crypto: bad }, PASSWORD)).toThrow(/invalid c/);
    expect(() => decryptKeystore('k', publishedScrypt, PASSWORD)).toThrow(/rejected by node:crypto/);
  });
});

describe('loadKeystoreAccount', () => {
  const dir = mkdtempSync(join(tmpdir(), 'keystore-'));
  writeFileSync(join(dir, 'deployer'), JSON.stringify(pbkdf2));
  const passwordFile = join(dir, 'password');
  writeFileSync(passwordFile, `${PASSWORD}\n`);

  it('returns the account for the key and trims the trailing newline', () => {
    expect(loadKeystoreAccount('deployer', passwordFile, dir).address).toBe(
      '0x008AeEda4D805471dF9b2A5B0f38A0C3bCBA786b',
    );
  });

  it('rejects a path, a missing keystore and a missing password file', () => {
    expect(() => loadKeystoreAccount('../deployer', passwordFile, dir)).toThrow(/not a path/);
    expect(() => loadKeystoreAccount('absent', passwordFile, dir)).toThrow('keystore "absent": cannot read');
    expect(() => loadKeystoreAccount('deployer', join(dir, 'nope'), dir)).toThrow(/cannot read/);
  });
});

describe('encryptKeystore', () => {
  it('round trips through decryptKeystore and names the address in lowercase hex', () => {
    const json = encryptKeystore(KEY, PASSWORD);
    expect(decryptKeystore('k', json, PASSWORD)).toBe(KEY);
    expect(json.address).toBe(privateKeyToAddress(KEY).slice(2).toLowerCase());
    expect(json).toMatchObject({ version: 3, crypto: { cipher: 'aes-128-ctr', kdf: 'scrypt' } });
  });

  it('never holds the key and is salted per call', () => {
    const [first, second] = [
      JSON.stringify(encryptKeystore(KEY, PASSWORD)),
      JSON.stringify(encryptKeystore(KEY, PASSWORD)),
    ];
    expect(first).not.toContain(KEY.slice(2));
    expect(first).not.toBe(second);
  });

  it('rejects the wrong password', () => {
    expect(() => decryptKeystore('k', encryptKeystore(KEY, PASSWORD), 'other')).toThrow(/wrong password/);
  });
});
