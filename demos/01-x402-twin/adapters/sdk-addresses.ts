import { PERMIT2_ADDRESS, x402ExactPermit2ProxyAddress } from '@x402/evm';

export class SdkAddressError extends Error {
  override readonly name = 'SdkAddressError';
}

export interface Addresses {
  readonly permit2: string;
  readonly proxy: string;
}

export const SDK_ADDRESSES: Addresses = { permit2: PERMIT2_ADDRESS, proxy: x402ExactPermit2ProxyAddress };

// The SDK constants and the registry must agree, or the facilitator would settle through another contract.
export function assertSdkAddresses(registry: Addresses, sdk: Addresses = SDK_ADDRESSES): void {
  const constants = [
    ['PERMIT2_ADDRESS', 'permit2'],
    ['x402ExactPermit2ProxyAddress', 'proxy'],
  ] as const;
  for (const [name, key] of constants) {
    if (sdk[key].toLowerCase() !== registry[key].toLowerCase())
      throw new SdkAddressError(`${name} is ${sdk[key]} in @x402/evm but ${registry[key]} in the registry`);
  }
}
