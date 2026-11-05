# Apply progress: repo-setup

chain_strategy: stacked-to-develop (each branch from the previous; all PRs target `develop`)

## Batch 1 (done): phase 0, PR 1, PR 2, PR 3

| PR | Task | Issue | PR URL | Commit | Authored lines (add+del, lockfile excluded) | CI |
|---|---|---|---|---|---|---|
| 1 | T1.7 plus ADRs | #10 | https://github.com/sebastianlujan/hackatwin-x402-team1-avalanche/pull/11 | e01820b | 181 (178 add, 3 del incl. 6 files) | pr-title, commits, branch-name, lint green |
| 2 | T1.1 | #12 | https://github.com/sebastianlujan/hackatwin-x402-team1-avalanche/pull/13 | dcef53d | 86 (lockfile 507 generated) | green |
| 3 | T1.2 | #14 | https://github.com/sebastianlujan/hackatwin-x402-team1-avalanche/pull/15 | 6ae4e3d | 8 (lockfile 592 total generated) | green |

Completed: 0.1, 0.3, 1.1 to 1.5, 2.1 to 2.5, 3.1 to 3.4. Pending after batch 2: see Batch 2.

## Batch 2 (done except admin steps): PR 4, PR 5, PR 6, PR 7

| PR | Task | Issue | PR URL | Commits | Authored lines (add+del, lockfile excluded) | CI |
|---|---|---|---|---|---|---|
| 4 | T1.3 | #16 | https://github.com/sebastianlujan/hackatwin-x402-team1-avalanche/pull/17 | 1ba9a83 | 102 (lockfile generated) | pr title, commits, branch name, lint green (workflow of that base) |
| 5 | T1.4 | #18 | https://github.com/sebastianlujan/hackatwin-x402-team1-avalanche/pull/19 | 9c2bd95 | 90 | all 8 jobs incl. ci-gate, biome, docs build green; `docs-site` artifact attached |
| 6 | T1.5 | #21 | https://github.com/sebastianlujan/hackatwin-x402-team1-avalanche/pull/22 | 1daaf49 (verbatim export), 2c8294e (ci-gate only, CODEOWNERS, docs) | 162 | all green |
| 7 | T1.6 | #23 | https://github.com/sebastianlujan/hackatwin-x402-team1-avalanche/pull/24 | 5856984 | 68 | all green; docs-deploy does not run on PRs |

Completed in batch 2: 4.1 to 4.6, 5.1 to 5.6, 6.1 to 6.3, 6.6, 7.2 to 7.4.

### Pending admin steps (not done, by instruction)
- 0.2 after each user merge (rebase or retarget the next child onto `develop`).
- 5.7 confirm `ci-gate` ran green on `develop` after PR 5 merges.
- 6.4 apply rulesets: `gh api -X PUT repos/<owner>/<repo>/rulesets/26496788 --input .github/rulesets/develop.json` and 26496789 with `main.json`; then empty `jq -S` diff and `rules/branches/develop` lists `ci-gate`. Only after 5.7 and PR 6 merged.
- 6.5 direct-push probes as a non-bypass actor, after 6.4.
- 7.1 Pages setup (`POST /pages` build_type=workflow, environment `github-pages` with custom branch policy `main` only).
- Phase 8 (`release/0.1.0`, deploy confirmation, idempotent re-run, back-merge).

### Batch 2 check results
- Docs: `pnpm --filter docs build` passes with no link fixes needed; a probe broken link fails the build naming it; `{1+1}` in `.md` renders literally; Mermaid renders on PLAN and architecture-alternative (headless Chrome, light theme; dark theme not inspected); all 5 SVGs emitted, none copied out of `docs/`.
- CI: `actionlint` exit 0; SHA-pin `rg` finds nothing; probe PR #20 (broken link) turned `docs build` and `ci-gate` red; title `x"; echo pwned; "` failed `pr title`, no command ran (only the action's quoted error line contains it). Probe PR closed, branch deleted.
- Rulesets: committed JSON `jq -S` identical to live before the check swap; second commit changes only `required_status_checks` to `ci-gate` (`integration_id` 15368 kept); `codeowners/errors?ref=feature/branch-rulesets` returns 0 errors (the default-branch call 404s until the file reaches `main`).

### Batch 2 deviations
- apps/docs pins `typescript` 5.9.3: `@docusaurus/tsconfig` sets `baseUrl`, removed in TypeScript 7 (design fallback).
- `@docusaurus/faster` added to the catalog (needed by `future.v4: true`); `allowBuilds` false for `core-js` and `@swc/core` in `pnpm-workspace.yaml` (pnpm 12 blocks build scripts and fails install).
- `sidebars.ts` is an untyped object: `@docusaurus/plugin-content-docs` types are not resolvable under strict pnpm.
- Design row "commitlint in CI via pnpm exec" not implemented: not in tasks T1.4; the commits job still uses wagoid action.
- Task 5.5 docs-only skip probe deferred (needs the new workflow on `develop`).
- Gate: the `ci-gate` job needs `changes`, so a docs-only PR on develop runs `docs build`; unrelated jobs skip.
- First commit of PR 5 was blocked locally (PATH lacked Node 26 for the hook) and retried; no content change.

## Check results
- Links: script walk over `docs/decisions.md` and `docs/adr/*` resolved all relative links and anchors (0 bad).
- `git diff -U0 docs/decisions.md`: only Open points annotations (refund closed, ICM license, backup RPC) plus added drift log.
- Toolchain run with Node 26.13.0 and pnpm 12.16.1 (`nvm install 26.13.0`, pnpm via nvm bin).
- Frozen install passes on a clean copy; stale lockfile exits 1; `pnpm lint` passes (5 files), a `var` probe fails lint; typecheck/test run with no workspaces.
- Hook: `bad message` rejected (also with `-a`), `chore(repo): add thing` accepted (empty probe commit reset), mode 755, fresh clone install sets `core.hooksPath=.husky/_`.

## Deviations
- `prepare: husky` moved from PR 2 to PR 3 (tasks 3.1) since husky is not installed in PR 2; design lists it among root scripts.
- `commitlint.config.mjs` reformatted by Biome (quotes) in PR 2 so `pnpm lint` passes.
- Merge commit of `origin/feature/ci-pipeline` is in the chain base (commits job passed).
- `engineStrict: true` is the only pnpm setting beyond globs and catalog.
- `openspec/changes/repo-setup/` is untracked and not committed.
