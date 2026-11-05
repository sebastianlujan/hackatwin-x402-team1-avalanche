export interface ConfigIssue {
  readonly variable: string;
  readonly message: string;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(issues.map((issue) => `${issue.variable}: ${issue.message}`).join('\n'));
    this.issues = issues;
  }
}
