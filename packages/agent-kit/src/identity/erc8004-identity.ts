import type { Address, AgentIdentity, ChainClient, Feedback, Hex, Receipt, Reputation } from '@hackatwin/core';
import { decodeEventLog } from 'viem';
import { identityAbi, reputationAbi } from './abi.ts';
import { IdentityTransactionError, RegisteredEventMissingError, SelfFeedbackError } from './errors.ts';

const ZERO_HASH: Hex = `0x${'0'.repeat(64)}`;

export interface Erc8004Options {
  readonly chain: ChainClient;
  readonly identity: Address;
  readonly reputation: Address;
  // The account the chain client signs with: it must never rate an agent it owns or operates.
  readonly signer: Address;
}

export class Erc8004Identity implements AgentIdentity {
  private readonly options: Erc8004Options;

  constructor(options: Erc8004Options) {
    this.options = options;
  }

  async register(agentUri: string): Promise<bigint> {
    const { chain, identity } = this.options;
    const receipt = await this.send({
      address: identity,
      abi: identityAbi,
      functionName: 'register',
      args: [agentUri],
    });
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== identity.toLowerCase()) continue;
      try {
        const event = decodeEventLog({
          abi: identityAbi,
          eventName: 'Registered',
          data: log.data,
          topics: log.topics as [Hex],
        });
        if (event.args?.agentId !== undefined) return event.args.agentId;
      } catch {}
    }
    throw new RegisteredEventMissingError(
      `transaction ${receipt.txHash} on chain ${chain.chainId} has no Registered event`,
    );
  }

  async ownerOf(agentId: bigint): Promise<Address> {
    const { chain, identity } = this.options;
    return (
      await chain.read<Address>({ address: identity, abi: identityAbi, functionName: 'ownerOf', args: [agentId] })
    ).value;
  }

  // Mirrors the registry's own check, so a rating that would revert is refused before it is sent.
  async giveFeedback(feedback: Feedback): Promise<Hex> {
    const { chain, identity, reputation, signer } = this.options;
    const own = await chain.read<boolean>({
      address: identity,
      abi: identityAbi,
      functionName: 'isAuthorizedOrOwner',
      args: [signer, feedback.agentId],
    });
    if (own.value) throw new SelfFeedbackError(feedback.agentId);
    const receipt = await this.send({
      address: reputation,
      abi: reputationAbi,
      functionName: 'giveFeedback',
      args: [feedback.agentId, feedback.value, feedback.valueDecimals, feedback.tag1, feedback.tag2, '', '', ZERO_HASH],
    });
    return receipt.txHash;
  }

  async reputation(agentId: bigint): Promise<Reputation> {
    const { chain, reputation } = this.options;
    const { value: clients } = await chain.read<readonly Address[]>({
      address: reputation,
      abi: reputationAbi,
      functionName: 'getClients',
      args: [agentId],
    });
    // getSummary reverts without clients.
    if (clients.length === 0) return { agentId, count: 0n, value: 0n, valueDecimals: 0 };
    const { value } = await chain.read<readonly [bigint, bigint, number]>({
      address: reputation,
      abi: reputationAbi,
      functionName: 'getSummary',
      args: [agentId, clients, '', ''],
    });
    return { agentId, count: value[0], value: value[1], valueDecimals: value[2] };
  }

  private async send(call: Parameters<ChainClient['write']>[0]): Promise<Receipt> {
    const { chain } = this.options;
    const receipt = await chain.waitForReceipt(await chain.write(call));
    if (receipt.status !== 'success')
      throw new IdentityTransactionError(`${call.functionName} reverted in ${receipt.txHash}`);
    return receipt;
  }
}
