import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError } from './config-error.ts';
import { ENV_VARIABLES } from './env.ts';
import { loadProfile } from './load-profile.ts';
import { PROFILE_NAMES, ProfileToken } from './profiles.ts';

const rpc = 'https://rpc.example.org';
const base = {
  ANTHROPIC_API_KEY: 'sk-test',
  AGENT_KEYSTORE: 'agent',
  AGENT_KEYSTORE_PASSWORD_FILE: '/run/secrets/agent',
  SELLER_KEYSTORE: 'seller',
  SELLER_KEYSTORE_PASSWORD_FILE: '/run/secrets/seller',
  FACILITATOR_KEYSTORE: 'facilitator',
  FACILITATOR_KEYSTORE_PASSWORD_FILE: '/run/secrets/facilitator',
  TREASURY_KEYSTORE: 'treasury',
  TREASURY_KEYSTORE_PASSWORD_FILE: '/run/secrets/treasury',
  CCHAIN_FORK_RPC_URL: 'http://127.0.0.1:8545',
  CCHAIN_RPC_URL: rpc,
  ARBITRUM_RPC_URL: rpc,
  BASE_RPC_URL: rpc,
  FUJI_RPC_URL: rpc,
  SEPOLIA_RPC_URL: 'wss://sepolia.example.org',
  TWINPAY_L1_RPC_URL: rpc,
  TWINPAY_L1_CHAIN_ID: '99999',
};

describe('valid profiles', () => {
  it.each([
    ['cchain-fork', 'ARGt', 'permit2'],
    ['fuji-crosschain', 'USDC', 'none'],
    ['twinpay-l1', 'USDC', 'permit2'],
    ['fuji-cchain', 'USDC', 'eip3009'],
  ] as const)('%s', (name, asset, x402) => {
    const profile = loadProfile(name, base);
    expect(profile).toMatchObject({ name, asset, x402, llm: { provider: 'claude', model: 'claude-sonnet-5-5' } });
    expect(profile.budget.perPayment).toEqual({ units: 1_000_000n, decimals: 6, currency: 'USD' });
    expect(profile.budget.total.units).toBe(5_000_000n);
  });

  it('parses the chain id to a number and omits the facilitator without x402', () => {
    const profile = loadProfile('fuji-crosschain', base);
    expect(profile.env.TWINPAY_L1_CHAIN_ID).toBe(99999);
    expect('facilitator' in profile).toBe(false);
    expect(loadProfile('twinpay-l1', base).facilitator).toBe('x402-ts');
  });

  it('keeps only the variables of the profile and the string overload returns a union', () => {
    const profile = loadProfile('fuji-cchain' as string, base);
    expect(Object.keys(profile.env)).not.toContain('CCHAIN_FORK_RPC_URL');
  });

  it('exposes a typed token', () => {
    expect(String(ProfileToken.description)).toBe('Profile');
  });
});

describe('failures', () => {
  it('lists the four valid names for an unknown profile', () => {
    const error = catchConfigError(() => loadProfile('mainnet', base));
    for (const name of PROFILE_NAMES) expect(error.message).toContain(name);
    expect(PROFILE_NAMES).toHaveLength(4);
  });

  it('falls back to the ambient environment', () => {
    expect(() => loadProfile('mainnet')).toThrow(ConfigError);
  });

  it('names both variables in one error', () => {
    const env = { ...base, FUJI_RPC_URL: undefined, TWINPAY_L1_CHAIN_ID: 'abc' };
    const error = catchConfigError(() => loadProfile('fuji-crosschain', env));
    expect(error.issues.map((i) => i.variable)).toEqual(['FUJI_RPC_URL', 'TWINPAY_L1_CHAIN_ID']);
    expect(error.message).toBe('FUJI_RPC_URL: is required\nTWINPAY_L1_CHAIN_ID: must be a positive integer');
  });

  it('treats empty strings as missing', () => {
    const error = catchConfigError(() => loadProfile('fuji-cchain', { ...base, BASE_RPC_URL: '' }));
    expect(error.message).toBe('BASE_RPC_URL: is required');
  });

  it.each([
    ['FUJI_RPC_URL', 'ftp://host', 'must be an http(s) or ws(s) URL'],
    ['FUJI_RPC_URL', 'not a url', 'must be an http(s) or ws(s) URL'],
    ['AGENT_KEYSTORE', '../keys/agent', 'must be a keystore name, not a path'],
    ['AGENT_KEYSTORE_PASSWORD_FILE', 'secrets/agent', 'must be an absolute path'],
  ])('rejects %s=%s', (variable, value, message) => {
    const error = catchConfigError(() => loadProfile('fuji-cchain', { ...base, [variable]: value }));
    expect(error.issues).toEqual([{ variable, message }]);
  });

  it('rejects a chain id that is not a safe integer', () => {
    const env = { ...base, TWINPAY_L1_CHAIN_ID: '9'.repeat(30) };
    expect(catchConfigError(() => loadProfile('twinpay-l1', env)).message).toBe(
      'TWINPAY_L1_CHAIN_ID: must be a safe integer',
    );
  });
});

describe('env coverage', () => {
  it('lists every schema variable in .env.example with an empty value', () => {
    const text = readFileSync(resolve(import.meta.dirname, '../../../.env.example'), 'utf8');
    const entries = text.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('#'));
    expect(entries.every((line) => /^[A-Z0-9_]+=$/.test(line))).toBe(true);
    expect(entries.map((line) => line.slice(0, -1)).sort()).toEqual([...ENV_VARIABLES].sort());
  });
});

function catchConfigError(run: () => unknown): ConfigError {
  try {
    run();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError');
}
