import type { GuardedClients } from '@hackatwin/chains';
import { x402Facilitator } from '@x402/core/facilitator';
import { toFacilitatorEvmSigner } from '@x402/evm';
import { ExactEvmScheme } from '@x402/evm/exact/facilitator';
import type { LocalAccount } from 'viem';
import type { FacilitatorLike } from './facilitator-app.ts';

export const NETWORK = 'eip155:43114';

// The only signer is the facilitator account, behind the guarded fork client.
export function createX402Facilitator(fork: GuardedClients, account: LocalAccount): FacilitatorLike {
  const wallet = fork.wallet(account);
  const signer = toFacilitatorEvmSigner({
    address: account.address,
    readContract: (args) => wallet.readContract(args as never),
    verifyTypedData: (args) => wallet.verifyTypedData(args as never),
    writeContract: (args) => wallet.writeContract(args as never),
    sendTransaction: (args) => wallet.sendTransaction(args as never),
    waitForTransactionReceipt: (args) => wallet.waitForTransactionReceipt(args),
    getCode: (args) => wallet.getCode(args),
  });
  const facilitator = new x402Facilitator().register(NETWORK, new ExactEvmScheme(signer));
  return {
    supported: () => facilitator.getSupported(),
    verify: (payload, requirements) => facilitator.verify(payload, requirements),
    settle: (payload, requirements) => facilitator.settle(payload, requirements),
  };
}
