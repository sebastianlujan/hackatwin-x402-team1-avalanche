// The message never carries the API key or the provider error text.
export class LlmError extends Error {
  override readonly name = 'LlmError';
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}
