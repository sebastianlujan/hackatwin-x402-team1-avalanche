import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { encryptKeystore } from '@hackatwin/chains/keystore';
import type { Address } from '@hackatwin/core';
import { getAddress } from 'viem';
import { generatePrivateKey } from 'viem/accounts';

export const ROLES = ['agent', 'seller', 'facilitator'] as const;
export type Role = (typeof ROLES)[number];

export const STATE_DIR = resolve(import.meta.dirname, '../../.demo1');

export interface RoleKeystore {
  readonly role: Role;
  readonly name: string;
  readonly passwordFile: string;
  readonly address: Address;
  readonly created: boolean;
}

export function ensureStateDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
}

// `wx` never overwrites an existing secret.
export const writeSecret = (path: string, content: string): void =>
  writeFileSync(path, content, { flag: 'wx', mode: 0o600 });

const addressOf = (file: string): Address =>
  getAddress(`0x${(JSON.parse(readFileSync(file, 'utf8')) as { address: string }).address}`);

// Creates a throwaway keystore and password file for the role, or keeps the existing pair.
export function ensureRoleKeystore(dir: string, role: Role): RoleKeystore {
  const file = join(dir, role);
  const passwordFile = join(dir, `${role}.password`);
  const base = { role, name: role, passwordFile };
  if (existsSync(file)) {
    if (!existsSync(passwordFile)) throw new Error(`keystore "${role}" exists without its password file`);
    return { ...base, address: addressOf(file), created: false };
  }
  const password = randomBytes(24).toString('hex');
  writeSecret(passwordFile, password);
  writeSecret(file, JSON.stringify(encryptKeystore(generatePrivateKey(), password)));
  return { ...base, address: addressOf(file), created: true };
}

// Non-secret variables for the scripts; the shell and `.env` override them.
export function writeDemoEnv(dir: string, rpcUrl: string, keystores: readonly RoleKeystore[]): string {
  const lines = [`KEYSTORE_DIR=${dir}`, `CCHAIN_FORK_RPC_URL=${rpcUrl}`];
  for (const { role, name, passwordFile } of keystores) {
    lines.push(
      `${role.toUpperCase()}_KEYSTORE=${name}`,
      `${role.toUpperCase()}_KEYSTORE_PASSWORD_FILE=${passwordFile}`,
    );
  }
  const file = join(dir, 'demo1.env');
  writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
  return file;
}
