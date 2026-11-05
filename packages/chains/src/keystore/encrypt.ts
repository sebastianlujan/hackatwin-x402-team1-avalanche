import { createCipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { keccak256 } from 'viem';
import { privateKeyToAddress } from 'viem/accounts';

const SCRYPT = { N: 8192, r: 8, p: 1 } as const;
const DKLEN = 32;

// Foundry-compatible V3 keystore: scrypt (N=8192, r=8, p=1) and aes-128-ctr, so `cast` can read it.
export function encryptKeystore(privateKey: `0x${string}`, password: string): Record<string, unknown> {
  const salt = randomBytes(32);
  const iv = randomBytes(16);
  const key = scryptSync(password, salt, DKLEN, { ...SCRYPT, maxmem: 256 * SCRYPT.N * SCRYPT.r + 1024 * 1024 });
  const cipher = createCipheriv('aes-128-ctr', key.subarray(0, 16), iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(privateKey.slice(2), 'hex')), cipher.final()]);
  const mac = keccak256(Buffer.concat([key.subarray(16, 32), ciphertext])).slice(2);
  return {
    address: privateKeyToAddress(privateKey).slice(2).toLowerCase(),
    crypto: {
      cipher: 'aes-128-ctr',
      cipherparams: { iv: iv.toString('hex') },
      ciphertext: ciphertext.toString('hex'),
      kdf: 'scrypt',
      kdfparams: { dklen: DKLEN, n: SCRYPT.N, p: SCRYPT.p, r: SCRYPT.r, salt: salt.toString('hex') },
      mac,
    },
    id: randomUUID(),
    version: 3,
  };
}
