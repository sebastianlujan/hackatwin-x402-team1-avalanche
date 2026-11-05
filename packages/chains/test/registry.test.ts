import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ChainError } from '../src/chain-error.ts';
import { chain, listChains, parseChain, toViemChain } from '../src/registry.ts';

const facts = (() => {
  const text = readFileSync(resolve(import.meta.dirname, '../../../docs/decisions.md'), 'utf8');
  return text.slice(text.indexOf('## Verified facts')).toLowerCase();
})();
const unverified = (addresses: string[]): string[] => addresses.filter((a) => !facts.includes(a.toLowerCase()));
const addresses = listChains().flatMap((c) => Object.values(c.contracts).map((x) => x.address));

const valid = {
  key: 'x',
  name: 'X',
  status: 'live',
  chainId: 1,
  access: 'read-only',
  rpc: { public: 'https://rpc.example.org' },
  contracts: {
    token: { address: '0x59863989d080B22476DB95656d0C3CC18be92214', source: 'https://example.org' },
  },
};

describe('registry', () => {
  it('loads six chains: five live with a chain ID and viem chain, the planned L1 with neither', () => {
    expect(listChains().map((c) => c.key)).toEqual(['cchain', 'fuji', 'sepolia', 'twinpay-l1', 'arbitrum', 'base']);
    const live = listChains().filter((c) => c.status === 'live');
    expect(live.map((c) => c.chainId)).toEqual([43114, 43113, 11155111, 42161, 8453]);
    expect(live.map((c) => toViemChain(c.key).id)).toEqual([43114, 43113, 11155111, 42161, 8453]);
    expect(chain('cchain')).toMatchObject({ access: 'fork-only' });
    expect(chain('twinpay-l1')).toMatchObject({ status: 'planned', contracts: {} });
    expect([chain('twinpay-l1').chainId, chain('twinpay-l1').rpc]).toEqual([undefined, undefined]);
    expect(() => toViemChain('twinpay-l1')).toThrow(/twinpay-l1/);
  });

  it('names an unknown key', () => {
    expect(() => chain('mainnet')).toThrow(ChainError);
    expect(() => chain('mainnet')).toThrow(/unknown chain "mainnet"/);
    expect(() => toViemChain('mainnet')).toThrow(/mainnet/);
  });

  it('keeps CCIP selectors as strings and the Base feed heartbeat at 86400', () => {
    expect(chain('fuji')).toMatchObject({ ccip: { chainSelector: '14767482510784806043' } });
    expect(chain('sepolia')).toMatchObject({ ccip: { chainSelector: '16015286601757825753' } });
    expect(chain('base').contracts.arsUsdFeed?.heartbeatSeconds).toBe(86400);
  });

  it('has a source on every entry', () => {
    expect(addresses.length).toBeGreaterThan(20);
    for (const c of listChains()) {
      for (const x of Object.values(c.contracts)) expect(x.source).toMatch(/^(https:\/\/|read: )/);
    }
  });

  it('has every registry address in Verified facts and rejects one that is not', () => {
    expect(unverified(addresses)).toEqual([]);
    expect(unverified(['0x1111111111111111111111111111111111111111'])).toHaveLength(1);
  });
});

describe('parseChain', () => {
  it('accepts a valid entry', () => {
    expect(parseChain(valid).key).toBe('x');
  });

  it('rejects a bad checksum and names the file and field', () => {
    const lower = valid.contracts.token.address.toLowerCase();
    const bad = { ...valid, contracts: { token: { ...valid.contracts.token, address: lower } } };
    expect(() => parseChain(bad, 'x.json')).toThrow(/x\.json: contracts\.token\.address: must be an EIP-55 address/);
  });

  it('rejects a missing or unsupported source', () => {
    const token = { address: valid.contracts.token.address };
    expect(() => parseChain({ ...valid, contracts: { token } })).toThrow(/contracts\.token\.source/);
    const http = { ...token, source: 'http://example.org' };
    expect(() => parseChain({ ...valid, contracts: { token: http } })).toThrow(/must be https:\/\/ or read: /);
  });

  it('rejects contracts on a planned chain', () => {
    const planned = { key: 'p', name: 'P', status: 'planned', contracts: valid.contracts };
    expect(() => parseChain(planned)).toThrow(ChainError);
  });
});

describe('parseChain icm facts', () => {
  const token = '0x59863989d080B22476DB95656d0C3CC18be92214';
  const blockchainId = `0x${'ab'.repeat(32)}`;

  it('accepts optional icm fields and leaves them out when absent', () => {
    const icm = { blockchainId, usdcTokenHome: token, usdcTokenRemote: token };
    expect(parseChain({ ...valid, icm })).toMatchObject({ icm });
    expect(parseChain({ ...valid, icm: {} })).toMatchObject({ icm: {} });
    expect(parseChain(valid)).not.toHaveProperty('icm');
  });

  it('rejects a short blockchain ID, a bad checksum and an unknown icm field', () => {
    expect(() => parseChain({ ...valid, icm: { blockchainId: '0xab' } }, 'x.json')).toThrow(/icm\.blockchainId/);
    const lower = token.toLowerCase();
    expect(() => parseChain({ ...valid, icm: { usdcTokenHome: lower } }, 'x.json')).toThrow(
      /icm\.usdcTokenHome: must be an EIP-55 address/,
    );
    expect(() => parseChain({ ...valid, icm: { relayer: token } })).toThrow(ChainError);
  });
});
