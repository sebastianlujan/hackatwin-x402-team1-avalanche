# Tasks: Core DI, ports, and config profiles (M3)

Inputs: `proposal.md`, `design.md`, `specs/{workspace-dependency-rule,di-container,core-domain-ports,config-profiles}/spec.md`,
`docs/PLAN.md` M3 (T3.1 to T3.4). T3.5 diagrams are out of scope (orchestrator).

Conventions: Conventional Commits, no AI attribution, English, code comments one line or none. TS tests are required
but not strict TDD (strict TDD is Solidity only); tests land in the same commit as the behavior they verify. Pins:
vitest 5.1.0, @vitest/coverage-v8 5.1.0, zod 4.6.7, @types/node 26.6.6, TypeScript 7.0.2 at root (fallback: pin
5.9.3 in the affected package only).

## Review Workload Forecast

| Field | Value |
|---|---|
| Review budget | 400 authored lines per PR (`pnpm-lock.yaml` generated, excluded) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked; first branch from `feature/docs-deploy` (PR #24), each next from the previous; all PRs target `develop` |
| Chained PRs recommended | Yes (six PRs, strictly stacked) |
| Decision needed before apply | Yes (see Risks below: T3.3a and T3.4 forecast above budget, T3.1a borderline) |

| PR | Branch | Forecast (authored lines) | 400-line risk |
|---|---|---|---|
| 1 T3.1a scaffold, CI, ADR, docs | `feature/workspace-scaffold` | 420 to 480 (14 packages x ~21 lines = ~300, root configs ~60, CI ~40, ADR ~50, docs ~10) | Medium-High |
| 2 T3.1b dependency rule | `feature/dependency-rule` | 320 to 400 (rule ~170, tests ~200) | Medium |
| 3 T3.2 container | `feature/core-di-container` | 330 to 400 (container ~140, tests ~230) | Medium |
| 4 T3.3a domain, codec, ports | `feature/core-ports` | 480 to 560 (types and ports ~260, money and codec ~110, tests ~170) | High |
| 5 T3.3b fakes | `feature/core-fakes` | 360 to 430 (fakes ~190, tests ~200) | Medium-High |
| 6 T3.4 config | `feature/core-config` | 520 to 620 (env ~80, profiles ~110, load ~110, `.env.example` ~40, tests ~240) | High |

Mitigations (apply if the running count passes 400 at PR creation; each is an already-defined work-unit seam):

- PR 1: split into 1a-i (scaffold: workspaces, base flags, root tsconfig, vitest config) and 1a-ii (CI jobs, ADR 0005,
  PLAN and README fix).
- PR 4: split into 4a (money, domain types, `AgentEvent` codec, tests) and 4b (seven ports, `tokens.ts`, compile check).
- PR 6: split into 6a (`env.ts`, `profiles.ts`, `loadProfile` happy path, `.env.example`) and 6b (raw-key guard, fork
  guard, `ConfigError` formatting, their tests).
- Splitting adds branches to the stack; the order below stays valid.

## Dependency graph

Sequential stack: T3.1a, then T3.1b, then T3.2, then T3.3a, then T3.3b, then T3.4. Each branch starts from the
previous one. Parallel work is possible only inside a PR (see "parallel" flags); there is one writer per PR.

Soft dependencies worth knowing: T3.1b needs the workspace layout from T3.1a; T3.2 and T3.3a need core's package and
the root Vitest config; T3.3b needs the ports from T3.3a; T3.4 needs `@hackatwin/core` (for `ProfileToken` types).
T3.2 and T3.3a touch disjoint files, so they could swap order without conflict if review timing demands it.

---

## PR 1: T3.1a Workspace scaffold, CI jobs, ADR 0005 (`feature/workspace-scaffold`)

Start: `feature/docs-deploy` (PR #24). End: 14 compiling placeholder workspaces, root `typecheck` and `test` scripts,
CI jobs wired into `ci-gate`, ADR 0005 and layout docs. Out of scope: any logic in core or config.
Spec links: `workspace-dependency-rule` (Workspace layout, CI gating).

- [x] 1.1 Resolve and pin versions (`npm view`): vitest, @vitest/coverage-v8, zod, @types/node; add to the
  `pnpm-workspace.yaml` catalog and add root devDependencies (vitest, coverage-v8, @types/node) in `package.json`.
  Update `pnpm-lock.yaml`. Parallel with 1.2. Accept: `pnpm install --frozen-lockfile` succeeds.
- [x] 1.2 `pnpm-workspace.yaml` packages: `apps/*`, `packages/*`, `demos/*`, `e2e/*`. `tsconfig.base.json` adds
  `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, lib `["ES2023", "ESNext.Disposable"]`. Verify at
  apply: `ESNext.Disposable` exists in TS 7 (else `ESNext`) and workspace scripts see the root `.bin` on `PATH`
  (else per-workspace `typescript` devDependency). Accept: `pnpm exec tsc --version` prints 7.0.2.
- [x] 1.3 Create the 14 workspaces per design table (`package.json` private, type module, version 0.0.0, `exports`,
  `typecheck: tsc --noEmit`; `tsconfig.json` extending base; entry file `export {};`). Demo folders hold `.gitkeep`;
  `packages/config` sets `types: ["node"]`; Demo 3 has `main.ts` and no `exports`; `apps/docs` is untouched.
  Depends on 1.2. Accept: `pnpm -r --if-present typecheck` passes across all workspaces (spec: Clean clone).
- [x] 1.4 Root `tsconfig.json` (covers `test/`, `vitest.config.ts`, `types: ["node"]`), root `vitest.config.ts`
  (includes `test/**/*.test.ts` and `{apps,packages,demos}/**/*.test.{ts,tsx}`; v8 coverage over `packages/*/src/**`;
  `branches: 100` for `packages/core/src/container.ts`), root scripts `typecheck` and `test`. Use
  `passWithNoTests` only until PR 2 lands a test. Accept: `pnpm typecheck` passes; `pnpm test` exits 0.
- [x] 1.5 CI (`.github/workflows/ci.yml`): `changes` job adds output and filter `ts` (`*root`, `test/**`,
  `vitest.config.ts`, `tsconfig.json`, `.env.example`, `packages/**`, `demos/**`, `apps/web/**`, `e2e/**`); new jobs
  `typecheck` and `test` (`needs: changes`, `if: needs.changes.outputs.ts == 'true'`, `timeout-minutes: 10`, biome
  job's setup and frozen install, then `pnpm typecheck` or `pnpm test`); `ci-gate.needs` adds both (ADR 0002).
  Accept: PR CI shows `typecheck` and `test` green and `ci-gate` waits on them (spec: CI gating, TypeScript change);
  a docs-only change skips both jobs.
- [x] 1.6 ADR 0005 `docs/adr/0005-config-package-outside-core.md` plus `docs/adr/README.md` index entry; fix
  `docs/PLAN.md` § 2 and `README.md` layout (add `packages/config`; core drops config schemas). Parallel with 1.5.
  Accept: `pnpm exec biome check` and the docs build (`apps/docs`) pass if Markdown is covered; links resolve.

Verification for the PR: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test`; CI green.
Rollback: revert the PR; nothing else depends on it until PR 2.

## PR 2: T3.1b Dependency-rule test (`feature/dependency-rule`)

Start: PR 1 branch. End: `test/dependency-rule.ts` and its test enforcing R1 to R6 on the real repo.
Out of scope: core logic. Spec links: `workspace-dependency-rule` (Core has no dependencies, Import direction).

- [x] 2.1 `test/dependency-rule.ts`: `readSnapshot(root)` (walk `apps`, `packages`, `demos`, `e2e`, skip
  `node_modules`, `dist`, `build`, `coverage`, `.next`, `.docusaurus`; read every `package.json` and
  `*.{ts,tsx,mts,cts}`; longest-directory workspace ownership) and pure `checkDependencyRule(snapshot): Violation[]`
  with R1 to R6 and the specifier extractor (`import`/`export ... from`, side-effect, `import()`, `require()`, type-only
  included). Violations print `R<n> <file>: <specifier>: <reason>`. Accept: `pnpm typecheck` passes.
- [x] 2.2 `test/dependency-rule.test.ts`: real repo yields zero violations, plus one in-memory fixture per rule and
  per spec scenario (Dependency added to core, Forbidden edge, Allowed Demo 3 edge, Demo 3 deep import, test-only
  fakes import, `process.env` outside `load-profile.ts`). Depends on 2.1. Accept: `pnpm test` green; each fixture
  fails on the named rule only; removing a fixture's trigger makes it pass.

Verification: `pnpm typecheck && pnpm test`; CI green. Rollback: delete the two `test/` files.

## PR 3: T3.2 Container (`feature/core-di-container`)

Start: PR 2 branch. End: `@hackatwin/core` container with typed tokens, scopes, cycles, child overrides, disposal,
100% branch coverage. Spec links: `di-container` (all requirements).

- [x] 3.1 `packages/core/src/container.ts` per design: `Token`, `token()`, `Scope`, `Resolver`, `Container`,
  `createContainer`, `ContainerError`; resolution algorithm steps 1 to 5 (closure-aware singleton reuse and
  placement), duplicate `register` throws, tracking resolver invalid after factory returns, `dispose()` idempotent
  with `AggregateError`, `[Symbol.asyncDispose]` alias. Export from `src/index.ts`. Accept: `pnpm typecheck` passes.
- [x] 3.2 `packages/core/src/container.test.ts` covering every spec scenario: Resolve, Missing token (message with
  path), Scope behavior (singleton vs transient), Cycle (`A -> B -> A`), Swap adapter for fake (closure rule: parent
  singleton reused unless its closure meets a child registration), Reverse order disposal (async before sync
  fallback), Disposer failure (`AggregateError`), post-dispose guards, duplicate register. Depends on 3.1. Accept:
  `pnpm test` green and the coverage gate reports 100% branches on `container.ts` (spec: Coverage gate); lowering a
  test makes the gate fail.

Verification: `pnpm typecheck && pnpm test`; CI green. Rollback: remove `container.ts`, its test, and the index
export; no consumer exists before M4.

## PR 4: T3.3a Domain types, codec, ports (`feature/core-ports`)

Start: PR 3 branch. End: Money, `AgentEvent` v1 codec, seven ports and `Ports` tokens. Spec links: `core-domain-ports`
(Domain types, AgentEvent wire format, Seven ports, Zero runtime dependencies and no adapters).

- [ ] 4.1 `packages/core/src/domain/money.ts`: `Address`, `Hex`, `AssetSymbol`, `Currency`, `Money`, `MoneyError`,
  `money`, `parseMoney`, `formatMoney`, `addMoney`, `compareMoney`, `convertMoney` (rounds up; mismatches throw).
  Parallel with 4.2. Accept: `pnpm typecheck`.
- [ ] 4.2 `domain/payment.ts` (`PaymentStatus` string union, `PaymentIntent`, `Quote`) and `domain/agent-event.ts`
  (`AgentEvent` v1 union with all eleven `type`s, `encodeAgentEvent`, `decodeAgentEvent`, `AgentEventError`; bigints
  as decimal strings; revive only `units` and `agentId`; reject unknown `version` or `type`). Accept: `pnpm typecheck`.
- [ ] 4.3 `ports/<port>.ts` for `PaymentGateway`, `AgentPolicy`, `AgentIdentity`, `ChainClient`, `LLM`, `PriceOracle`,
  `CrossChainMessenger` with their supporting types, plus `ports/tokens.ts` (`Ports` map) and index exports.
  Depends on 4.1 and 4.2 (Money, Quote, PaymentStatus). Accept: `pnpm typecheck`.
- [ ] 4.4 Tests: `money.test.ts` (Money arithmetic, Mismatched decimals, round-up conversion, parse and format),
  `agent-event.test.ts` (Round trip for every `type` including bigint fields, Unknown version, unknown type), and a
  compile-only check that `Ports` has seven tokens typed to the interfaces. Depends on 4.1 to 4.3. Accept:
  `pnpm test` green; the dependency-rule test still reports zero violations (Import scan: core has no runtime
  imports and no adapters).

Verification: `pnpm typecheck && pnpm test`; CI green. Rollback: remove `domain/`, `ports/`, and index exports.

## PR 5: T3.3b Test fakes (`feature/core-fakes`)

Start: PR 4 branch. End: seven fakes under `@hackatwin/core/testing`, never imported by production code. Spec links:
`core-domain-ports` (Test-only fakes).

- [ ] 5.1 `packages/core/src/testing/` with `FakePaymentGateway`, `FakeAgentIdentity`, `FakeAgentPolicy`,
  `FakeChainClient`, `ScriptedLLM`, `FakePriceOracle`, `FakeCrossChainMessenger` per the design table (no clock or
  randomness unless injected), `testing/index.ts`, and the `./testing` `exports` entry in core's `package.json`.
  Each class `implements` its port. Accept: `pnpm typecheck` (fakes implement each port).
- [ ] 5.2 Tests per fake (scripted replay and request recording, exhaustion throws for `ScriptedLLM`, sequential
  ids and hashes, feedback to reputation, injected clock for the oracle, `track` yields scripted hops) and one
  container test swapping a fake into a child scope. Depends on 5.1. Accept: `pnpm test` green (Scripted fake); the
  dependency-rule test passes and its R5 fixture still fails a non-test import of `@hackatwin/core/testing` (Fake in
  production code).

Verification: `pnpm typecheck && pnpm test`; CI green. Rollback: remove `src/testing/` and the `./testing` export.

## PR 6: T3.4 Config profiles (`feature/core-config`)

Start: PR 5 branch. End: `@hackatwin/config` with four profiles, the sole `process.env` reader, `.env.example`.
Spec links: `config-profiles` (all requirements); ADR 0005.

- [ ] 6.1 Toolchain check first: install zod 4.6.7 in `packages/config` and confirm `tsc --noEmit` passes under
  TypeScript 7.0.2; if it breaks, pin `typescript` 5.9.3 in `packages/config` only and record it in the PR body.
  Accept: `pnpm -F @hackatwin/config typecheck` passes.
- [ ] 6.2 `packages/config/src/env.ts` (zod schemas keyed by variable names; http(s) and ws(s) URLs; loopback guard
  for `CCHAIN_FORK_RPC_URL` only; positive-integer chain ids; keystore name `[A-Za-z0-9._-]`; absolute password-file
  path; `ENV_VARIABLES` export of every schema key) and `profiles.ts` (static values per profile table: asset, x402
  method, `llm`, budget 1 USD and 5 USD at 6 decimals, `facilitator: 'x402-ts'` on x402 profiles; `ProfileToken`,
  `PROFILE_NAMES`). Parallel with 6.3 once types are agreed. Accept: `pnpm typecheck`.
- [ ] 6.3 `load-profile.ts`: `loadProfile(name, env = process.env)` with literal-name overloads; unknown name
  `ConfigError` listing four names; empty string counts as missing; raw-key guard (`<ROLE>_PRIVATE_KEY`,
  `<ROLE>_KEYSTORE_PASSWORD`, `PRIVATE_KEY`, 64-hex `<ROLE>_KEYSTORE`) naming only the variable; `safeParse` then merge
  statics; one `ConfigError` with `issues: { variable, message }[]` and `VARIABLE: reason` lines, no values or zod
  dumps. `index.ts` exports. Depends on 6.2. Accept: `pnpm typecheck`; the R6 test still passes (only this file reads
  `process.env`).
- [ ] 6.4 `.env.example` listing every `ENV_VARIABLES` entry, empty. Parallel with 6.3. Accept: covered by the test
  in 6.5.
- [ ] 6.5 Tests (injected env records): Valid profile for each of the four profiles, Unknown profile, Env coverage
  (`.env.example` keys equal `ENV_VARIABLES`), Raw key (each trigger, value never in the message), Remote RPC (fork
  guard accepts `localhost`, `127.0.0.1`, `[::1]`; rejects remote; `CCHAIN_RPC_URL` not guarded), Two bad values (one
  `ConfigError`, two lines). Depends on 6.3 and 6.4. Accept: `pnpm test` green; `pnpm typecheck` green; CI green
  including `ts` filter triggered by `.env.example`.

Verification: `pnpm typecheck && pnpm test`; CI green. Rollback: remove `packages/config/src/*`, restore the empty
entry, revert `.env.example`.

---

## Chain context for PR bodies

Each PR states start, end, prior dependencies, follow-ups, and out-of-scope items, plus a dependency diagram with the
current PR marked. Order: PR 1 (`feature/workspace-scaffold`, base `feature/docs-deploy`), PR 2, PR 3, PR 4, PR 5, PR 6.
All PRs target `develop`; retarget as parents merge. Workload per PR is `additions + deletions`, excluding
`pnpm-lock.yaml`.

## Open items carried from design (resolved at apply)

- [x] `ESNext.Disposable` lib in TypeScript 7 (task 1.2): exists, no fallback.
- [x] Root `node_modules/.bin` on workspace script `PATH` (task 1.2): works, no per-workspace typescript.
- [ ] TypeScript 7 with zod (task 6.1).
- [ ] Adapter `AgentEvent` emission (T5.8) and `TWINPAY_L1_CHAIN_ID` removal (T6.1) are outside this change.
