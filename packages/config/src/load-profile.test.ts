import { describe, expect, it } from 'vitest';
import { ConfigError } from './config-error.ts';
import { loadProfile, loadRpcUrls, rpcVariable } from './load-profile.ts';
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

describe('raw-key guard', () => {
  const key = `0x${'ab'.repeat(32)}`;

  it.each(['PRIVATE_KEY', 'AGENT_PRIVATE_KEY', 'SELLER_KEYSTORE_PASSWORD', 'TREASURY_PRIVATE_KEY'])(
    'rejects %s',
    (variable) => {
      const error = catchConfigError(() => loadProfile('fuji-cchain', { ...base, [variable]: key }));
      expect(error.issues).toEqual([
        { variable, message: 'raw secrets are not allowed, reference a keystore instead' },
      ]);
      expect(error.message).not.toContain(key);
    },
  );

  it.each([key, 'ab'.repeat(32)])('rejects a 64-hex keystore value', (value) => {
    const error = catchConfigError(() => loadProfile('fuji-cchain', { ...base, AGENT_KEYSTORE: value }));
    expect(error.issues).toEqual([
      { variable: 'AGENT_KEYSTORE', message: 'looks like a raw private key, use a keystore name' },
    ]);
    expect(error.message).not.toContain('abab');
  });

  it('accepts a normal keystore name and reports guard and schema issues together', () => {
    expect(loadProfile('fuji-cchain', { ...base, AGENT_KEYSTORE: 'deployer-1' }).env.AGENT_KEYSTORE).toBe('deployer-1');
    const error = catchConfigError(() => loadProfile('fuji-cchain', { ...base, PRIVATE_KEY: key, FUJI_RPC_URL: 'x' }));
    expect(error.issues.map((i) => i.variable)).toEqual(['PRIVATE_KEY', 'FUJI_RPC_URL']);
  });
});

describe('fork guard', () => {
  it.each(['http://localhost:8545', 'http://127.0.0.1:8545', 'ws://[::1]:8545'])('accepts %s', (url) => {
    expect(loadProfile('cchain-fork', { ...base, CCHAIN_FORK_RPC_URL: url }).env.CCHAIN_FORK_RPC_URL).toBe(url);
  });

  it('rejects a remote RPC and names the field', () => {
    const url = 'https://api.avax.network/ext/bc/C/rpc';
    const error = catchConfigError(() => loadProfile('cchain-fork', { ...base, CCHAIN_FORK_RPC_URL: url }));
    expect(error.issues).toEqual([
      { variable: 'CCHAIN_FORK_RPC_URL', message: 'must be a loopback URL (localhost, 127.0.0.1 or [::1])' },
    ]);
  });

  it('does not guard CCHAIN_RPC_URL', () => {
    const url = 'https://api.avax.network/ext/bc/C/rpc';
    expect(loadProfile('cchain-fork', { ...base, CCHAIN_RPC_URL: url }).env.CCHAIN_RPC_URL).toBe(url);
  });
});

describe('loadRpcUrls', () => {
  const needed = { arbitrum: 'https://arb1.arbitrum.io/rpc', base: 'https://mainnet.base.org' };

  it('needs no secrets: an empty env yields the registry defaults', () => {
    expect(loadRpcUrls(needed, {})).toEqual(needed);
  });

  it('lets the env override a default, and treats an empty value as unset', () => {
    const urls = loadRpcUrls(needed, { ARBITRUM_RPC_URL: rpc, BASE_RPC_URL: '' });
    expect(urls).toEqual({ arbitrum: rpc, base: needed.base });
  });

  it('maps a dashed key to its variable', () => {
    expect(rpcVariable('twinpay-l1')).toBe('TWINPAY_L1_RPC_URL');
    expect(loadRpcUrls({ 'twinpay-l1': undefined }, { TWINPAY_L1_RPC_URL: rpc })).toEqual({ 'twinpay-l1': rpc });
  });

  it('names the variable when a chain has neither a value nor a default', () => {
    const error = catchConfigError(() => loadRpcUrls({ 'twinpay-l1': undefined, base: needed.base }, {}));
    expect(error.issues).toEqual([{ variable: 'TWINPAY_L1_RPC_URL', message: 'is required' }]);
  });

  it('names the variable, never the value, for an invalid URL', () => {
    const error = catchConfigError(() => loadRpcUrls(needed, { BASE_RPC_URL: 'ftp://secret-host/key' }));
    expect(error.issues).toEqual([{ variable: 'BASE_RPC_URL', message: 'must be an http(s) or ws(s) URL' }]);
    expect(error.message).not.toContain('secret-host');
  });

  it('falls back to the ambient environment', () => {
    expect(() => loadRpcUrls({ 'no-such-chain': undefined })).toThrow(ConfigError);
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
