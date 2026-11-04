import { createDecipheriv, pbkdf2Sync, scryptSync, timingSafeEqual } from 'node:crypto';
import { keccak256 } from 'viem';
import { KeystoreError } from './keystore-error.ts';

interface Crypto {
  readonly cipher: string;
  readonly ciphertext: string;
  readonly cipherparams: { readonly iv: string };
  readonly kdf: string;
  readonly kdfparams: Record<string, unknown>;
  readonly mac: string;
}

const bytes = (hex: string): Buffer => Buffer.from(hex, 'hex');
const num = (params: Record<string, unknown>, field: string, name: string): number => {
  const value = params[field];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new KeystoreError(`keystore "${name}": invalid ${field}`);
  }
  return value;
};

function deriveKey(crypto: Crypto, password: string, name: string): Buffer {
  const { kdf, kdfparams: p } = crypto;
  const salt = bytes(String(p.salt));
  const dklen = num(p, 'dklen', name);
  if (kdf === 'scrypt') {
    const [N, r, parallel] = [num(p, 'n', name), num(p, 'r', name), num(p, 'p', name)];
    try {
      return scryptSync(password, salt, dklen, { N, r, p: parallel, maxmem: 256 * N * r + 1024 * 1024 });
    } catch {
      throw new KeystoreError(`keystore "${name}": scrypt parameters rejected by node:crypto (needs N < 2^(16r))`);
    }
  }
  if (kdf === 'pbkdf2' && p.prf === 'hmac-sha256')
    return pbkdf2Sync(password, salt, num(p, 'c', name), dklen, 'sha256');
  throw new KeystoreError(`keystore "${name}": unsupported kdf ${kdf}`);
}

// Returns the private key as 0x hex; a MAC mismatch never echoes the password.
export function decryptKeystore(name: string, json: unknown, password: string): `0x${string}` {
  const file = json as { version?: unknown; crypto?: Crypto; Crypto?: Crypto };
  const crypto = file.crypto ?? file.Crypto;
  if (file.version !== 3 || crypto === undefined)
    throw new KeystoreError(`keystore "${name}": not a version 3 keystore`);
  if (crypto.cipher !== 'aes-128-ctr')
    throw new KeystoreError(`keystore "${name}": unsupported cipher ${crypto.cipher}`);
  const key = deriveKey(crypto, password, name);
  const ciphertext = bytes(crypto.ciphertext);
  const mac = bytes(keccak256(Buffer.concat([key.subarray(16, 32), ciphertext])).slice(2));
  const expected = bytes(crypto.mac);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    throw new KeystoreError(`keystore "${name}": wrong password or corrupted file`);
  }
  const decipher = createDecipheriv('aes-128-ctr', key.subarray(0, 16), bytes(crypto.cipherparams.iv));
  return `0x${Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('hex')}`;
}
