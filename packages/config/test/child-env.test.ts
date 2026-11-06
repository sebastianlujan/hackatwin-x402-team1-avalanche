import { describe, expect, it } from 'vitest';
import { childEnv } from '../src/load-profile.ts';

const parent = {
  HOME: '/home/dev',
  PATH: '/somewhere/else',
  ANTHROPIC_API_KEY: 'sk-secret',
  AGENT_KEYSTORE: 'agent',
  FUJI_RPC_URL: 'https://rpc.example.org/key',
};

describe('childEnv', () => {
  it('passes HOME and a fixed PATH with the foundry bin, and nothing else from the parent', () => {
    const env = childEnv({}, parent);
    expect(env.HOME).toBe('/home/dev');
    expect(env.PATH?.split(':')[0]).toBe('/home/dev/.foundry/bin');
    expect(env.PATH).not.toContain('/somewhere/else');
    expect(Object.keys(env).sort()).toEqual(['HOME', 'LC_ALL', 'PATH']);
  });

  it('adds the extra variables on top and lets them win', () => {
    const env = childEnv({ DEPLOY_PARAMS_DIR: '/p', LC_ALL: 'en_US' }, parent);
    expect(env.DEPLOY_PARAMS_DIR).toBe('/p');
    expect(env.LC_ALL).toBe('en_US');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('refuses a parent without HOME', () => {
    expect(() => childEnv({}, {})).toThrow('HOME');
  });
});
