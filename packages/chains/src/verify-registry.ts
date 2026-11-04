import type { Address } from '@hackatwin/core';
import { type AbiFunction, type AbiParameter, parseAbiItem } from 'viem';
import type { ChainsClient } from './chain-client.ts';
import type { ChainEntry, ContractCheck, LiveChain } from './registry.ts';

export interface VerifyReport {
  readonly lines: readonly string[];
  readonly ok: boolean;
}

type Connect = (chain: LiveChain) => Promise<ChainsClient>;

const coerce = (param: AbiParameter, value: string): unknown => {
  if (/^u?int/.test(param.type)) return BigInt(value);
  return param.type === 'bool' ? value === 'true' : value;
};

// `@name` cites the address of a sibling entry; anything else is a literal.
const resolve = (value: string, chain: LiveChain): string => {
  const sibling = value.startsWith('@') ? chain.contracts[value.slice(1)] : undefined;
  return sibling?.address ?? value;
};

async function runCheck(client: ChainsClient, chain: LiveChain, address: Address, check: ContractCheck, block: bigint) {
  const item = parseAbiItem(check.call) as AbiFunction;
  const args = (check.args ?? []).map((arg, i) => coerce(item.inputs[i] as AbiParameter, resolve(arg, chain)));
  const { value } = await client.read({ address, abi: [item], functionName: item.name, args }, { blockNumber: block });
  if (check.expect === undefined) return undefined;
  const [got, want] = [String(value), resolve(check.expect, chain)];
  return got.toLowerCase() === want.toLowerCase() ? undefined : `${item.name} returned ${got}, expected ${want}`;
}

async function verifyEntry(
  client: ChainsClient,
  chain: LiveChain,
  name: string,
  block: bigint,
): Promise<string | undefined> {
  const contract = chain.contracts[name];
  if (contract === undefined) return 'unknown entry';
  try {
    if ((await client.codeSize(contract.address, block)) === 0) return 'no code at this address';
    for (const check of contract.checks ?? []) {
      const failure = await runCheck(client, chain, contract.address, check, block);
      if (failure !== undefined) return failure;
    }
  } catch {
    return 'call failed or RPC unreachable';
  }
  return undefined;
}

// Reads every live chain at one block; failures name chain, entry and address, never the RPC URL.
export async function verifyRegistry(chains: readonly ChainEntry[], connect: Connect): Promise<VerifyReport> {
  const lines: string[] = [];
  let ok = true;
  for (const chain of chains) {
    if (chain.status === 'planned') {
      lines.push(`SKIP ${chain.key} (planned, not deployed)`);
      continue;
    }
    let client: ChainsClient | undefined;
    let block: bigint | undefined;
    try {
      client = await connect(chain);
      block = await client.blockNumber();
    } catch {
      /* every entry of this chain fails below */
    }
    for (const [name, contract] of Object.entries(chain.contracts)) {
      const failure =
        client === undefined || block === undefined ? 'RPC unreachable' : await verifyEntry(client, chain, name, block);
      if (failure !== undefined) ok = false;
      lines.push(
        `${failure === undefined ? 'PASS' : 'FAIL'} ${chain.key} ${name} ${contract.address}${failure === undefined ? '' : ` (${failure})`}`,
      );
    }
  }
  return { lines, ok };
}
