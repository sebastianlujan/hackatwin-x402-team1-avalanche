# Delta for CI Workspace Jobs

Base: repo-setup `ci-workspace-jobs` (not yet archived). Checked: "Path-filtered workspace jobs" and "Aggregate gate" keep
their text; `web-build` is one more instance of them, and its name collides with no base requirement, so ADDED is used.

## ADDED Requirements

### Requirement: web-build job in ci-gate

CI MUST run a `web-build` job (install, build `apps/web`, static secret scan) on changes to `apps/web`, any
`packages/**` workspace, `demos/01-*/**`, or the root manifests, and `ci-gate` MUST depend on it so a skipped job passes
and a failed one blocks.

#### Scenario: Failing build

- GIVEN `apps/web` fails to build
- WHEN CI runs
- THEN `web-build` fails and `ci-gate` fails

#### Scenario: Unrelated change

- GIVEN a change touching only `docs/`
- WHEN CI runs
- THEN `web-build` is skipped and `ci-gate` passes

## Traceability

| Done-when box | Requirement |
|---|---|
| The app builds in CI | web-build job in ci-gate |
