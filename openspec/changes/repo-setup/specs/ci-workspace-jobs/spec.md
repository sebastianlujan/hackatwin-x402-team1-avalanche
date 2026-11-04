# Delta for ci-workspace-jobs

## ADDED Requirements

### Requirement: Path-filtered workspace jobs

`ci.yml` MUST have a `changes` job and per-workspace lint, typecheck, test, and build jobs that run only when their
paths change. Demo 3 jobs MUST also run on Demo 1, Demo 2, or `packages/` changes.

#### Scenario: Docs-only change

- Given a PR touching only `docs/*.md`
- When CI runs
- Then docs jobs run and unrelated workspace jobs are skipped

#### Scenario: Demo 3 dependency

- Given a PR touching only a Demo 1, Demo 2, or `packages/` path
- When CI runs
- Then the Demo 3 jobs run

#### Scenario: Root config change

- Given a PR touching `pnpm-lock.yaml` or `biome.json`
- When CI runs
- Then all workspace jobs run

### Requirement: Aggregate gate

`ci.yml` MUST have one job named `ci-gate` that succeeds when every required job succeeded or was skipped and fails
if any failed or was cancelled. It MUST be the only job later required by rulesets.

#### Scenario: Skips do not block

- Given a PR where some workspace jobs are skipped
- When `ci-gate` runs
- Then it succeeds

#### Scenario: Failure blocks

- Given a PR where one workspace job fails
- When `ci-gate` runs
- Then it fails

### Requirement: Reproducible installs

Workspace jobs MUST use the pnpm cache and `pnpm install --frozen-lockfile`.

#### Scenario: Stale lockfile

- Given `package.json` changed without the lockfile
- When a workspace job runs
- Then its install step fails

### Requirement: Job limits and permissions

Every job MUST set `timeout-minutes` and least-privilege `permissions`, with top-level `permissions` at
`contents: read` or narrower.

#### Scenario: Limits present

- Given all files in `.github/workflows/`
- When scanned
- Then every job has `timeout-minutes` and an explicit permissions scope

### Requirement: Pinned actions and actionlint

Every `uses:` MUST reference a full commit SHA, and an actionlint job MUST pass.

#### Scenario: Pins

- Given all workflow files
- When scanned
- Then no `uses:` references a tag or branch

#### Scenario: actionlint fails on bad syntax

- Given a workflow with a syntax error
- When actionlint runs
- Then it fails

## Traceability

| PLAN T1.4 checkbox | Requirement |
|---|---|
| Each job runs only when its paths change; Demo 3 extra triggers | Path-filtered workspace jobs; Aggregate gate; Reproducible installs |
| Every job has `timeout-minutes` and least-privilege `permissions` | Job limits and permissions |
| Actions pinned to SHAs and actionlint passes | Pinned actions and actionlint |
