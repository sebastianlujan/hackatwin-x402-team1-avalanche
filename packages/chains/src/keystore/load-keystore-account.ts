import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { decryptKeystore } from './decrypt.ts';
import { KeystoreError } from './keystore-error.ts';

const NAME = /^[A-Za-z0-9._-]+$/;

// Reads `<dir>/<name>` (Foundry's keystore directory by default) and the password file.
export function loadKeystoreAccount(
  name: string,
  passwordFile: string,
  dir = join(homedir(), '.foundry', 'keystores'),
) {
  if (!NAME.test(name)) throw new KeystoreError(`keystore "${name}": must be a keystore name, not a path`);
  let json: unknown;
  let password: string;
  try {
    json = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    password = readFileSync(passwordFile, 'utf8').replace(/\r?\n$/, '');
  } catch {
    throw new KeystoreError(`keystore "${name}": cannot read the keystore or its password file`);
  }
  return privateKeyToAccount(decryptKeystore(name, json, password));
}
