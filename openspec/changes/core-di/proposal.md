# Proposal: Core DI, ports, and config profiles (M3)

## Intent

Adapters (M4) and demos need shared types, ports, a container, and validated profiles, or roots read env ad hoc and tests cannot swap adapters (Q1). Success: a test swaps a real adapter for a fake via `child()`.

## Scope

### In Scope

- T3.1: placeholder workspaces (PLAN §2), root Vitest, dependency-rule test, CI jobs.
- T3.2: hand-rolled typed container (PLAN §5.1, §5.2).
- T3.3: `Money`, `Quote`, `PaymentIntent`, `AgentEvent`, the seven ports, fakes in `@hackatwin/core/testing`.
- T3.4: `packages/config` with zod profile schemas and the only `process.env` reader.

### Out of Scope

- T3.5 diagrams, adapters (M4), contracts (M7), frontend (M10), `defineDemo3Config` (T9.1).

## Capabilities

### New Capabilities

- `workspace-dependency-rule`: layout, import direction, CI checks.
- `di-container`: tokens, scopes, overrides, cycles, disposal.
- `core-domain-ports`: domain types, ports, test fakes.
- `config-profiles`: four profiles, env loading.

### Modified Capabilities

None.

## Approach

- **Core vs zod:** schemas live in `@hackatwin/config` (zod plus core), keeping core dependency-free (M3) with validation at the edge (PLAN §5.2). Zod in core breaks M3; hand-rolled validation duplicates zod. ADR 0005; PLAN §2 and README updated.
- **Env:** `loadProfile(name, env = process.env)` is the sole `process.env` read; roots call it, tests pass a record.
- **Dependency rule:** one Vitest test over manifests and imports, no new tool. Fails if core gains a dependency, anything imports `demos/`, demos cross-import (Demo 3 only via `module.ts`), `core/testing` leaks outside tests, or `process.env` appears outside the loader.
- **Domain:** `Money` is bigint units plus decimals; statuses reuse contract state names.
- **Testing (Q21):** Vitest pinned in the catalog; tests required, not strict TDD; full container branch coverage.
- **CI:** a `ts` filter in `changes` (root files, `packages/**`, `demos/**`, `apps/web/**`, `e2e/**`) runs new `typecheck` and `test` jobs, both in `ci-gate` needs.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/core`, `packages/config` | New | Container, ports, profiles |
| `apps/web`, `demos/*`, `e2e/*`, other `packages/*` | New | Empty placeholders |
| `pnpm-workspace.yaml`, `ci.yml`, `.env.example` | Modified | Globs, catalog, jobs |
| `docs/PLAN.md`, `README.md`, `docs/adr/` | Modified | ADR 0005 |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| TypeScript 7 and zod types unproven together | Med | Check first in T3.4 |
| T3.3 exceeds 400 lines | High | Split ports and fakes |
| `AgentEvent` changes break recordings (M12) | Med | Version field, string amounts |

## Rollback Plan

One squash commit per slice; revert newest first. Nothing consumes core before M4.

## Dependencies

- Stack base: PR #24 (`feature/docs-deploy`).
- Decisions: Q1, Q5, Q11, Q12, Q13, Q16, Q17, Q20, Q21, C1.

## Success Criteria

- [ ] Every workspace typechecks; root `pnpm test` runs.
- [ ] The dependency-rule test fails on each forbidden edge.
- [ ] Container tests cover scopes, cycle paths, reverse disposal, overrides.
- [ ] Core has no dependencies; each port has a test-only fake.
- [ ] Invalid profiles fail readably at startup; profiles name keystores, never keys.
- [ ] `typecheck` and `test` gate `ci-gate`.

## Assumptions to confirm

- Keystore passwords come from a file path, never an env value.
- `cchain-fork` rejects non-loopback RPC URLs at load.
- `AgentEvent` carries a schema version.
