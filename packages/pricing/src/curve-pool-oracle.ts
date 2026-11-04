import type { Address, ChainClient } from '@hackatwin/core';
import { PricingError } from './pricing-error.ts';
import type { RateReading, RateSource } from './rate-reading.ts';

export interface CurvePoolAddresses {
  readonly pool: Address;
  readonly argt: Address;
  readonly usdt0: Address;
}

const word = (name: string, inputs: readonly { name: string; type: string }[], type: string) =>
  ({ type: 'function', name, stateMutability: 'view', inputs, outputs: [{ name: '', type }] }) as const;
const ABI = [word('coins', [{ name: 'i', type: 'uint256' }], 'address'), word('price_oracle', [], 'uint256')];

export class CurvePoolOracle implements RateSource {
  private readonly client: ChainClient;
  private readonly addresses: CurvePoolAddresses;

  constructor(client: ChainClient, addresses: CurvePoolAddresses) {
    this.client = client;
    this.addresses = addresses;
  }

  async reading(): Promise<RateReading> {
    const { pool, argt, usdt0 } = this.addresses;
    const blockNumber = await this.client.blockNumber();
    const read = <T>(functionName: string, args: readonly unknown[]) =>
      this.client.read<T>({ address: pool, abi: ABI, functionName, args }, { blockNumber });
    const [first, second, price] = await Promise.all([
      read<Address>('coins', [0n]),
      read<Address>('coins', [1n]),
      read<bigint>('price_oracle', []),
    ]);
    this.expectCoin(0, 'ARGt', first.value, argt);
    this.expectCoin(1, 'USD₮0', second.value, usdt0);
    return { source: 'curve', argtPerUsd: price.value, chainId: this.client.chainId, blockNumber };
  }

  private expectCoin(index: number, name: string, actual: Address, expected: Address): void {
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      throw new PricingError(`curve pool coins(${index}) is ${actual}, expected ${name} ${expected}`);
    }
  }
}
