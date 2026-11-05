# Delta for Workspace Dependency Rule

Base: `core-di` change spec `workspace-dependency-rule` (on `feature/implementation-plan`, not yet archived). Only
"Import direction" changes; the other base requirements stay as they are.

Detection definitions used below:
- Client file: a source file whose first statement, after blank lines and comments, is the `"use client"` directive.
- Web server file: a file under `apps/web/src/server/**` that imports `server-only`.
- Presentational file: any file under `apps/web/src/components/**` or `packages/ui/src/**`.
- Server code: any import of `server-only` or any file under `apps/web/src/server/**`.

## MODIFIED Requirements

### Requirement: Import direction

The test MUST fail when: any package or app imports from `demos/`, or depends on a demo package in its manifest, except
that the `apps/web` manifest MAY depend on a demo package and web server files (only files under
`apps/web/src/server/**` that import `server-only`) MAY import `@hackatwin/demo-*/module`, and only that entry (R2); any
other `apps/web` file importing a demo, even through `module`, fails; a demo imports another demo, except Demo 3
importing only another demo's `module.ts`; `@hackatwin/core/testing` is imported outside test files; or `process.env`
appears outside the config loader. Demos MAY import packages.
(Previously: no exception existed, so `apps/web` could neither import nor depend on any demo.)

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

#### Scenario: Web server file imports a module

- GIVEN `apps/web/src/server/root.ts` imports `server-only` and `@hackatwin/demo-01-x402-twin/module`
- WHEN the test runs
- THEN it passes

#### Scenario: Web deep or relative demo import

- GIVEN a web server file imports `@hackatwin/demo-01-x402-twin/root` or a relative path into `demos/`
- WHEN the test runs
- THEN it fails with R2

#### Scenario: Non-server web file imports a module

- GIVEN an `apps/web` file outside `apps/web/src/server/**`, or a server-folder file without `server-only`, imports
  `@hackatwin/demo-01-x402-twin/module`
- WHEN the test runs
- THEN it fails with R2

#### Scenario: Client file imports a module

- GIVEN an `apps/web` client file imports `@hackatwin/demo-01-x402-twin/module`
- WHEN the test runs
- THEN it fails with R2

#### Scenario: Other apps and packages stay forbidden

- GIVEN a file in `apps/docs` or `packages/*` imports a demo package, or their manifest depends on one
- WHEN the test runs
- THEN it fails with R2

#### Scenario: Web manifest

- GIVEN `apps/web/package.json` depends on `@hackatwin/demo-01-x402-twin`
- WHEN the test runs
- THEN it passes, while the same entry in `apps/docs/package.json` fails with R2

## ADDED Requirements

### Requirement: R10 presentational purity

A presentational file MUST NOT import `react` hooks, `wagmi`, `@tanstack/react-query`, or `@hackatwin/core`. Test files
are exempt.

#### Scenario: Hook

- GIVEN `apps/web/src/components/x.tsx` imports `useEffect` from `react`
- WHEN the test runs
- THEN it fails with R10

#### Scenario: Clean atom

- GIVEN a file under `packages/ui/src` importing only types and sibling files
- WHEN the test runs
- THEN it passes

### Requirement: R11 client files stay out of server code

A client file MUST NOT import `@hackatwin/config`, `@hackatwin/agent-kit`, `@hackatwin/pricing`, the
`@hackatwin/chains` root entry, `@hackatwin/chains/keystore`, a demo package, or server code. The only `chains` entry a
client file MAY import is `@hackatwin/chains/registry`. Test files are exempt.

#### Scenario: Config in a client file

- GIVEN a client file imports `@hackatwin/config`
- WHEN the test runs
- THEN it fails with R11

#### Scenario: Chains root, agent-kit, or pricing in a client file

- GIVEN a client file imports `@hackatwin/chains`, `@hackatwin/agent-kit`, or `@hackatwin/pricing`
- WHEN the test runs
- THEN it fails with R11 for each import

#### Scenario: Registry entry in a client file

- GIVEN a client file imports `@hackatwin/chains/registry`
- WHEN the test runs
- THEN R11 is not reported

#### Scenario: Server file

- GIVEN a web server file imports `@hackatwin/config`
- WHEN the test runs
- THEN R11 is not reported

### Requirement: Violation type and self-test

The `Violation['rule']` union MUST include R10 and R11, and the rule's own tests MUST cover each scenario above with
in-memory snapshots.

#### Scenario: Snapshot tests

- GIVEN the snapshots for the scenarios above
- WHEN `checkDependencyRule` runs
- THEN the reported rules match each scenario

## Traceability

| Done-when box | Requirement |
|---|---|
| T10.2 presentational components import no hooks or ports (lint rule) | R10 presentational purity |
| T10.2 secrets never reach the client bundle | R11 client files stay out of server code |
| Proposal: R2 web exception, `module` only | Import direction |
