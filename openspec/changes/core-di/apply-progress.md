# Apply progress: core-di

## Batch 1 (done): PR 1 (split in two), PR 2, PR 3

Mode: standard (TypeScript, tests required, no strict TDD). Delivery: stacked, every PR targets `develop`, no `size:exception`.

| Task | PR | Branch | Issue | Commit | Authored lines | CI |
|---|---|---|---|---|---|---|
| 1.1 to 1.4 scaffold | #27 | `feature/workspace-scaffold` (base `feature/docs-deploy`) | #25 | 7702044 | 260 | green |
| 1.5, 1.6 CI, ADR 0005, docs | #28 | `feature/workspace-ci-docs` | #26 | 9b7a068 | 103 | green |
| 2.1, 2.2 dependency rule | #30 | `feature/dependency-rule` | #29 | e162f62 | 280 | green |
| 3.1, 3.2 container | #32 | `feature/core-di-container` | #31 | d634814 | 348 | green |


## Batch 2 (done): PR 4 (split), PR 5, PR 6 (split)

| Task | PR | Branch | Issue | Commit | Authored lines | CI |
|---|---|---|---|---|---|---|
| 4.1, 4.2, money and codec tests | #34 | `feature/core-domain` | #33 | 68eb186 | 350 | green |
| 4.3, 4.4 ports, tokens, compile check | #36 | `feature/core-ports` | #35 | aa2ef76 | 240 | green |
| 5.1, 5.2 fakes | #38 | `feature/core-fakes` | #37 | 28002be | 328 | green |
| 6.1 to 6.5 profiles, loader, `.env.example` | #40 | `feature/core-config` | #39 | 3311693 | 299 | green |
| 6.3 guards (raw key, fork) | #42 | `feature/core-config-guards` | #41 | a9dfc26 | 83 | green |

All tasks complete (stack: #32 -> #34 -> #36 -> #38 -> #40 -> #42, all targeting `develop`).

## Findings and deviations

- `Hop` lives in `domain/agent-event.ts` (the event embeds it) and is re-exported from the messenger port, so PR 4a is self-contained.
- `convertMoney(amount, rate, target)`: rate is the price of one target unit in the amount's currency; result rounds up.
- `decodeAgentEvent` revives only the known bigint paths per event type (amounts and `agentId`), not by key name, so tool inputs are never touched.
- `erasableSyntaxOnly` forbids constructor parameter properties: fakes use explicit fields.
- zod 4.6.7 typechecks under TypeScript 7.0.2 (task 6.1): no `typescript` pin in `packages/config`.
- Config split seam moved slightly: `ConfigError` formatting ships in 6a (needed for unknown profile); 6b holds only the raw-key and fork guards.
- `@hackatwin/config` depends on `@hackatwin/core` (workspace) for `ProfileToken` and `Money`; the dependency-rule test stays green.
- A dependency-rule R6 scan matches the text `process.env` anywhere in a file, including test titles outside `load-profile.ts`.

- `ESNext.Disposable` exists in TypeScript 7.0.2; workspace scripts see the root `.bin`; no fallback needed.
- The `type:chore` label does not exist in the repo; PRs are created without labels (matches #24).
- Root `tsconfig.json` includes `test` and `vitest.config.ts`; `test/` has no `.gitkeep` before PR 2.
- Dependency rule: relative imports from packages or apps into `demos/` report R2 (not R4); relative cross-workspace imports otherwise report R4; e2e files may import `@hackatwin/core/testing`.
- Container: coverage gate verified (single test run fails at 51.72% branches); `pnpm-lock.yaml` excluded from line counts.
