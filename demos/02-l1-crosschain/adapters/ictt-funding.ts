import type { Address, ChainClient, ContractCall, Hex } from '@hackatwin/core';
import { parseAbi, zeroAddress } from 'viem';

export const REQUIRED_GAS_LIMIT = 250_000n;

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);
const HOME_ABI = parseAbi([
  'struct SendTokensInput { bytes32 destinationBlockchainID; address destinationTokenTransferrerAddress; address recipient; address primaryFeeTokenAddress; uint256 primaryFee; uint256 secondaryFee; uint256 requiredGasLimit; address multiHopFallback; }',
  'function send(SendTokensInput input, uint256 amount)',
]);

export interface IcttFundingOptions {
  readonly client: ChainClient;
  readonly token: Address;
  readonly home: Address;
  readonly remote: Address;
  readonly destination: Hex;
  readonly owner: Address;
}

export interface IcttFunding {
  // Sends the amount from the owner through the home to the recipient on the L1; the relay delivers it.
  fund(recipient: Address, amount: bigint): Promise<Hex>;
}

export function createIcttFunding({
  client,
  token,
  home,
  remote,
  destination,
  owner,
}: IcttFundingOptions): IcttFunding {
  const write = async (call: ContractCall): Promise<Hex> => {
    const receipt = await client.waitForReceipt(await client.write(call));
    if (receipt.status !== 'success') throw new Error(`${call.functionName} reverted in ${receipt.txHash}`);
    return receipt.txHash;
  };
  return {
    async fund(recipient, amount) {
      const { value: allowed } = await client.read<bigint>({
        address: token,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, home],
      });
      if (allowed < amount) {
        await write({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [home, amount] });
      }
      const input = {
        destinationBlockchainID: destination,
        destinationTokenTransferrerAddress: remote,
        recipient,
        primaryFeeTokenAddress: zeroAddress,
        primaryFee: 0n,
        secondaryFee: 0n,
        requiredGasLimit: REQUIRED_GAS_LIMIT,
        multiHopFallback: zeroAddress,
      };
      return write({ address: home, abi: HOME_ABI, functionName: 'send', args: [input, amount] });
    },
  };
}
