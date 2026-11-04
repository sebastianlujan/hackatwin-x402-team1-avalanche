import { assertLocalChain, type LocalChain, localChain } from '@hackatwin/chains';

export const LOCAL_HUB = localChain('local-hub', { chainId: 31337, rpcUrl: 'http://127.0.0.1:18545' });
export const LOCAL_L1 = localChain('local-l1', { chainId: 31338, rpcUrl: 'http://127.0.0.1:18546' });

// The RPC answer is the only trusted source of the chain ID; a mismatch with the static is refused.
export async function probeChainId(chain: LocalChain): Promise<number> {
  assertLocalChain(chain);
  const response = await fetch(chain.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
  });
  const reported = Number(((await response.json()) as { result?: string }).result);
  if (reported !== chain.chainId)
    throw new Error(`local chain "${chain.key}" reports chain ID ${reported}, expected ${chain.chainId}`);
  return reported;
}

export function assertDistinctChainIds(hub: LocalChain, l1: LocalChain): void {
  if (hub.chainId === l1.chainId) throw new Error('local chains need distinct chain IDs');
}
