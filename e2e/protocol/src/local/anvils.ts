import { assertLocalChain, type LocalChain, localChain } from '@hackatwin/chains';

export const LOCAL_HUB = localChain('local-hub', { chainId: 31337, rpcUrl: 'http://127.0.0.1:18545' });
export const LOCAL_L1 = localChain('local-l1', { chainId: 31338, rpcUrl: 'http://127.0.0.1:18546' });

const call = async (chain: LocalChain, method: string): Promise<unknown> => {
  assertLocalChain(chain);
  const response = await fetch(chain.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
  });
  return ((await response.json()) as { result?: unknown }).result;
};

// The RPC answer is the only trusted source of the chain ID; a mismatch with the static is refused.
export async function probeChainId(chain: LocalChain): Promise<number> {
  const reported = Number(await call(chain, 'eth_chainId'));
  if (reported !== chain.chainId)
    throw new Error(`local chain "${chain.key}" reports chain ID ${reported}, expected ${chain.chainId}`);
  return reported;
}

// The unlocked sender is only safe on a throwaway anvil: check the chain ID and the client.
export async function probeAnvil(chain: LocalChain): Promise<void> {
  await probeChainId(chain);
  if (!/anvil/i.test(String(await call(chain, 'web3_clientVersion'))))
    throw new Error(`local chain "${chain.key}" does not report anvil`);
}

export function assertDistinctChainIds(hub: LocalChain, l1: LocalChain): void {
  if (hub.chainId === l1.chainId) throw new Error('local chains need distinct chain IDs');
}
