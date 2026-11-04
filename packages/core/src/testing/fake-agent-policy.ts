import type { Money } from '../domain/money.ts';
import type { AgentPolicy } from '../ports/agent-policy.ts';

type Decision = { readonly allowed: boolean; readonly reason: string };

export class FakeAgentPolicy implements AgentPolicy {
  readonly authorized: Money[] = [];
  readonly recorded: Money[] = [];

  private readonly decide: (amount: Money) => Decision;

  constructor(decide: (amount: Money) => Decision = () => ({ allowed: true, reason: 'allowed' })) {
    this.decide = decide;
  }

  async authorize(amount: Money): Promise<Decision> {
    this.authorized.push(amount);
    return this.decide(amount);
  }

  async record(amount: Money): Promise<void> {
    this.recorded.push(amount);
  }
}
