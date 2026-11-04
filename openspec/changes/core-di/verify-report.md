# Verify report: core-di (M3)

Verdict: PASS WITH WARNINGS. 0 CRITICAL, 2 WARNING, 2 SUGGESTION.
Verified at `feature/core-config-guards` (a9dfc26), top of the stack #27 -> #42.

## Execution evidence

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm typecheck` (root plus all workspaces, TS 7.0.2) | OK |
| `pnpm test` (vitest 5.1.0, coverage) | 7 files, 105 tests passed, exit 0 |
| Coverage | 100% statements, lines, functions; 99.15% branches overall |
| `packages/core/src/container.ts` branches | 100% (threshold set in `vitest.config.ts`; not listed as partial; run exits 0) |
| `pnpm exec biome check .` | 88 files, clean |
| CI #27 #28 #30 #32 #34 #36 #38 #40 #42 | all checks pass, including `ci-gate`; `typecheck` and `test` jobs present from #28 on (#27 predates the CI wiring, which is task 1.5 in #28) |

## Spec compliance

| Requirement / scenario | Status | Evidence |
|---|---|---|
| Layout / Clean clone | PASS | typecheck and test run green across all workspaces |
| Core has no dependencies / Dependency added to core | PASS | `packages/core/package.json` has no `dependencies`; `test/dependency-rule.test.ts:61` (R1) |
| Import direction / Forbidden edge | PASS | `test/dependency-rule.test.ts:80` (R2) |
| Allowed Demo 3 edge | PASS | `test/dependency-rule.test.ts:94` (R3) |
| Demo 3 deep import | PASS | `test/dependency-rule.test.ts:101`, `:114` |
| Testing import outside tests | PASS | `test/dependency-rule.test.ts:121` (R5) |
| `process.env` outside loader | PASS | `test/dependency-rule.test.ts:130` (R6); real repo zero violations `:34` |
| CI gating / TypeScript change | PASS | `.github/workflows/ci.yml:113-123` `ts` filter, jobs `:140`, `:158`, `ci-gate.needs` `:204` |
| Typed tokens, Resolve, Missing token | PASS | `container.ts:93` message; `container.test.ts:20,27,31` |
| Scopes | PASS | `container.test.ts:62,72` |
| Cycle `A -> B -> A` | PASS | `container.ts:80`; `container.test.ts:81` |
| Child overrides / Swap adapter | PASS | `container.test.ts:93,103,111,116,124` |
| Disposal reverse order, parent untouched | PASS | `container.test.ts:153,195` |
| Disposer failure aggregated | PASS | `container.ts:68`; `container.test.ts:175` |
| Branch coverage gate | PASS | threshold in `vitest.config.ts`; 100% reported; apply-progress records a failing run at 51.72% |
| Domain types, Money arithmetic, Mismatched decimals | PASS | `money.test.ts:7,12,17`; `payment.ts:3` has all seven statuses |
| AgentEvent Round trip (>2^53), Unknown version | PASS | `agent-event.test.ts:39,44,51,55` |
| Seven ports, Compile check | PASS | `ports.test.ts:68,74`; typecheck; fakes `implements` ports |
| Zero runtime deps, no adapters | PASS | core package.json; R1 test |
| Scripted fake, Fake in production code | PASS | `fakes.test.ts:22,29`; R5 test |
| Four profiles, Valid profile, Unknown profile | PASS | `load-profile.test.ts:30,61` |
| Sole env reader, Env coverage | PASS | R6 test; `load-profile.test.ts:150`; `.env.example` lists keys empty |
| Raw key (value not echoed) | PASS | `load-profile.ts:8-21`; `load-profile.test.ts:101-123` |
| Fork guard | PASS | `load-profile.test.ts:130-146` |
| Readable startup failure, Two bad values | PASS | `load-profile.test.ts:71` |

No FAIL and no NOT-VERIFIABLE items. Tasks 1.1 to 6.5 are all marked complete and match the code.

## Design deviations (apply-progress) vs specs

| Deviation | Violates spec? |
|---|---|
| `Hop` defined in `domain/agent-event.ts`, re-exported by the messenger port | No |
| `convertMoney(amount, rate, target)` signature and round-up semantics | No (spec silent) |
| Decoder revives bigints by known path per event type | No (matches wire format) |
| Fakes use explicit fields (`erasableSyntaxOnly`) | No |
| 6a/6b seam: `ConfigError` formatting moved to 6a | No |
| `@hackatwin/config` depends on `@hackatwin/core` | No (design says config = zod + core) |
| R6 matches `process.env` text anywhere outside the loader | No (stricter than spec; see suggestion) |
| Relative cross-workspace imports reported as R2/R4; e2e may import core/testing | No (consistent with R5 intent) |

## Issues

CRITICAL: none.

WARNING
1. `packages/config/src/load-profile.ts:16` has an untested branch (`env[variable] ?? ''`), so config is at 93.33% branches. No gate requires it (only `container.ts`), so this does not violate the spec.
2. Task 1.5 "docs-only change skips typecheck/test" and "lowering a test fails the gate" were verified by apply-progress and CI config reading only, not re-run here.

SUGGESTION
1. Add a unit test for the missing-key default in `load-profile.ts:16`, or simplify the expression.
2. R6 flags the text `process.env` in test titles; consider an exemption if it causes friction in M4.
