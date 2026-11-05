export class SelfFeedbackError extends Error {
  override readonly name = 'SelfFeedbackError';
  readonly agentId: bigint;
  constructor(agentId: bigint) {
    super(`agent ${agentId} is owned or operated by the rating account; self-feedback is not allowed`);
    this.agentId = agentId;
  }
}

export class RegisteredEventMissingError extends Error {
  override readonly name = 'RegisteredEventMissingError';
}

export class IdentityTransactionError extends Error {
  override readonly name = 'IdentityTransactionError';
}
