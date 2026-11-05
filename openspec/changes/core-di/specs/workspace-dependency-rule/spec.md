# Workspace Dependency Rule Specification

## Purpose

Layout, import direction, and CI checks that keep dependencies pointing toward `packages/core`.

## Requirements

### Requirement: Workspace layout

Every workspace in PLAN section 2 (apps, demos, packages, e2e, including the three Demo 1 and Demo 2 roots and adapters folders) MUST exist as a placeholder and typecheck. Root `pnpm test` MUST run Vitest.

#### Scenario: Clean clone

- GIVEN a clean clone with a frozen lockfile
- WHEN `pnpm typecheck` and `pnpm test` run from the root
- THEN every workspace typechecks and Vitest exits 0

### Requirement: Core has no dependencies

`packages/core` MUST declare no runtime `dependencies`. The dependency-rule test MUST fail if one is added.

#### Scenario: Dependency added to core

- GIVEN `packages/core/package.json` gains a `dependencies` entry
- WHEN the dependency-rule test runs
- THEN it fails and names the package

### Requirement: Import direction

The test MUST fail when: any package or app imports from `demos/`; a demo imports another demo, except Demo 3 importing only another demo's `module.ts`; `@hackatwin/core/testing` is imported outside test files; or `process.env` appears outside the config loader. Demos MAY import packages.

#### Scenario: Forbidden edge

- GIVEN `packages/pricing` imports from `demos/01-x402-twin`
- WHEN the test runs
- THEN it fails naming the file and the import

#### Scenario: Allowed Demo 3 edge

- GIVEN Demo 3 imports `demos/01-x402-twin/module.ts`
- WHEN the test runs
- THEN it passes

#### Scenario: Demo 3 deep import

- GIVEN Demo 3 imports `demos/01-x402-twin/adapters/x`
- WHEN the test runs
- THEN it fails

### Requirement: CI gating

`ci.yml` MUST define a `ts` path filter (root files, `packages/**`, `demos/**`, `apps/web/**`, `e2e/**`) and `typecheck` and `test` jobs that run when it matches. Both MUST be in `ci-gate` needs.

#### Scenario: TypeScript change

- GIVEN a PR touching `packages/core`
- WHEN CI runs
- THEN `typecheck` and `test` run and `ci-gate` waits on them

## Traceability

| Done-when | Requirement |
|---|---|
| T3.1 every workspace builds | Workspace layout |
| T3.1 fails if core gains a dependency or a package imports `demos/` | Core has no dependencies; Import direction |
| T3.1 demos import only packages; only Demo 3 imports `module.ts` | Import direction |
| Proposal: `typecheck` and `test` gate `ci-gate` | CI gating |
