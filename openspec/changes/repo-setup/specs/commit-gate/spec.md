# Delta for commit-gate

## ADDED Requirements

### Requirement: Hook installed by pnpm install

`pnpm install` MUST install a husky `commit-msg` hook.

#### Scenario: Hook present

- Given a clean clone
- When `pnpm install` completes
- Then `.husky/commit-msg` exists and is executable

### Requirement: Hook uses the CI config

The hook MUST run commitlint with the existing `commitlint.config.mjs` and no separate local rule set.

#### Scenario: Bad message rejected

- Given staged changes
- When `git commit -m "bad message"` runs
- Then the commit is rejected with a commitlint error

#### Scenario: Good message accepted

- Given staged changes
- When `git commit -m "chore(repo): add thing"` runs
- Then the commit succeeds

### Requirement: CI commits job stays green

Adding the hook MUST NOT change the verdict of the CI `commits` job.

#### Scenario: Same verdict locally and in CI

- Given a PR with conventional commits
- When CI runs after the hook is added
- Then the `commits` job passes
- And a PR with a non-conventional title still fails it

### Requirement: Hook documented

`CONTRIBUTING.md` MUST state that `pnpm install` installs the commit-msg hook.

#### Scenario: Documented

- Given `CONTRIBUTING.md`
- When searched for "commit-msg"
- Then a match explains the local check

## Traceability

| PLAN T1.2 checkbox | Requirement |
|---|---|
| `pnpm install` installs the hook | Hook installed by pnpm install |
| A non-conventional message is rejected locally | Hook uses the CI config (bad message scenario) |
| The CI `commits` job stays green | CI commits job stays green |
