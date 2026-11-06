import { chain, type LiveChain } from '@hackatwin/chains';
import { describe, expect, it } from 'vitest';
import { assertSdkAddresses, SDK_ADDRESSES, SdkAddressError } from '../../adapters/sdk-addresses.ts';

const cchain = chain('cchain') as LiveChain;
const registry = {
  permit2: cchain.contracts.permit2?.address as string,
  proxy: cchain.contracts.x402Proxy?.address as string,
};

describe('assertSdkAddresses', () => {
  it('passes for the pinned @x402/evm and the registry', () => {
    expect(() => assertSdkAddresses(registry)).not.toThrow();
  });

  it('compares case-insensitively', () => {
    expect(() => assertSdkAddresses({ permit2: registry.permit2.toLowerCase(), proxy: registry.proxy })).not.toThrow();
  });

  it('names the proxy constant on drift', () => {
    const drifted = { ...registry, proxy: '0x0000000000000000000000000000000000000001' };
    expect(() => assertSdkAddresses(drifted)).toThrow(SdkAddressError);
    expect(() => assertSdkAddresses(drifted)).toThrow(/x402ExactPermit2ProxyAddress/);
  });

  it('names the Permit2 constant on drift', () => {
    const sdk = { ...SDK_ADDRESSES, permit2: '0x0000000000000000000000000000000000000002' };
    expect(() => assertSdkAddresses(registry, sdk)).toThrow(/PERMIT2_ADDRESS/);
  });
});
