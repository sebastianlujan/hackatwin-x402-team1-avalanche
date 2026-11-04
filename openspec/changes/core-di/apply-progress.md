# Apply progress: core-di

## Batch 1 (done): PR 1 (split in two), PR 2, PR 3

Mode: standard (TypeScript, tests required, no strict TDD). Delivery: stacked, every PR targets `develop`, no `size:exception`.

| Task | PR | Branch | Issue | Commit | Authored lines | CI |
|---|---|---|---|---|---|---|
| 1.1 to 1.4 scaffold | #27 | `feature/workspace-scaffold` (base `feature/docs-deploy`) | #25 | 7702044 | 260 | green |
| 1.5, 1.6 CI, ADR 0005, docs | #28 | `feature/workspace-ci-docs` | #26 | 9b7a068 | 103 | green |
| 2.1, 2.2 dependency rule | #30 | `feature/dependency-rule` | #29 | e162f62 | 280 | green |
| 3.1, 3.2 container | #32 | `feature/core-di-container` | #31 | d634814 | 348 | green |

Remaining: PR 4 (T3.3a, 4.1 to 4.4), PR 5 (T3.3b), PR 6 (T3.4 config, split 6a and 6b if over 400).

## Findings and deviations

- `ESNext.Disposable` exists in TypeScript 7.0.2; workspace scripts see the root `.bin`; no fallback needed.
- The `type:chore` label does not exist in the repo; PRs are created without labels (matches #24).
- Root `tsconfig.json` includes `test` and `vitest.config.ts`; `test/` has no `.gitkeep` before PR 2.
- Dependency rule: relative imports from packages or apps into `demos/` report R2 (not R4); relative cross-workspace imports otherwise report R4; e2e files may import `@hackatwin/core/testing`.
- Container: coverage gate verified (single test run fails at 51.72% branches); `pnpm-lock.yaml` excluded from line counts.
