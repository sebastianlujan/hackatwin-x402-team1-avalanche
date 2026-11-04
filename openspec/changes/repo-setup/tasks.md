# Tasks: Repo setup (M1)

Change: `repo-setup`. Inputs: proposal, six specs, design, `docs/PLAN.md` T1.1 to T1.7.
Strict TDD does not apply (no contracts, Q21). Acceptance checks are commands or CI outcomes.
Placeholders: `<owner>/<repo>` is `sebastianlujan/hackatwin-x402-team1-avalanche`.

## Review Workload Forecast

| PR | Task | Branch | Estimated changed lines (authored) | 400-line risk |
|---|---|---|---|---|
| 1 | T1.7 plus ADRs | `feature/decisions-drift` | about 230 (ADRs 4 files plus README about 150, decisions.md about 70, pointer lines) | Low |
| 2 | T1.1 | `feature/pnpm-workspace` | about 210 (configs, catalog, `.env.example`); `pnpm-lock.yaml` is generated | Low |
| 3 | T1.2 | `feature/commit-hooks` | about 60 (hook, devDependencies, CONTRIBUTING) | Low |
| 4 | T1.3 | `feature/docusaurus-site` | about 260 (config, sidebars, tsconfig, `docs/README.md`, link fixes); lockfile generated | Medium (link fixes in existing docs are unknown until the first build) |
| 5 | T1.4 | `feature/ci-workspace-jobs` | about 170 (`ci.yml` changes, gate, filters) | Low |
| 6 | T1.5 | `feature/branch-rulesets` | about 230 (two ruleset exports, CODEOWNERS, CONTRIBUTING); the export JSON size depends on live rules | Medium |
| 7 | T1.6 | `feature/docs-deploy` | about 130 (workflow, CONTRIBUTING Pages section) | Low |
| 8 | Release step | `release/0.1.0` into `main` | 0 authored (merge of `develop`) | None |

- Total authored: about 1290 lines across 7 PRs, each under the 400-line budget.
- Chained PRs recommended: Yes. The stack is inherent: each branch starts from the previous one (first branch starts
  from `feature/implementation-plan` merged with `feature/ci-pipeline`); all PRs target `develop`; the user merges manually.
- Decision needed before apply: No. The delivery facts already fix the strategy as stacked PRs targeting `develop`
  (not a tracker branch). Record `chain_strategy: stacked-to-develop` in the apply progress.
- Polluted-diff guard: after the user squash-merges any of #3, #5, #7, #9 or an earlier M1 PR, rebase or retarget
  the next child so only its own work unit appears (task 0.2).

## Phase 0: Base and chain hygiene

- [x] 0.1 (sequential, first) Create branch `feature/decisions-drift` from `feature/implementation-plan` merged with
  `feature/ci-pipeline`. Check: `git diff develop...HEAD --stat` shows only the content of PRs #3, #5, #7, #9 until
  edits begin. Note: no state-changing git beyond the apply phase.
- [ ] 0.2 (repeats after each user merge) Rebase or retarget the next child onto the new `develop` tip. Check: the PR
  diff shows only the current task files; every PR targets `develop`.
- [x] 0.3 Each PR body carries Chain Context: start, end, dependencies, follow-up, out of scope, and a dependency
  diagram marking the current PR (work-unit-commits and chained-pr conventions). Commits are conventional, English,
  with no AI attribution.

## Phase 1: PR 1, T1.7 plus ADRs (`feature/decisions-drift`, depends on none)

Specs: decision-log (all five requirements).

- [x] 1.1 Add `docs/adr/README.md` and `docs/adr/0001` to `0004` (Biome, `ci-gate` only, docs in place, Pages from
  `main`). Check: every ADR link resolves (`rg -n '\]\(' docs/adr` plus a manual link walk); satisfies the
  design Architecture Decisions refs.
- [x] 1.2 In `docs/decisions.md` add `### Drift log (2026-11-04)` after Open points with the six PLAN Step 0 rows
  (CCIP `MAINTENANCE`, validator `v1.15.2`, C-Chain execution Helicon with pick `N` behind the head (T5.1), ICM license
  and O7, backup RPC, x402-rs), each linking to PLAN Step 0. Check: requirement "Step 0 drift recorded"; PLAN T1.7
  box 1.
- [x] 1.3 Close the refund open point with links to `standards/smart-contracts.md#2-state-pattern` and the verified
  ICTT allowance sweep to `fallbackRecipient`; annotate ICM license and backup RPC; add the pointer that the overview
  label fix is tracked by T3.5; add one pointer line to `adr/README.md`. Check: requirements "Refund open point
  closed", "Overview label fix tracked"; PLAN T1.7 box 2.
- [x] 1.4 Verify no decision, value, or address line changed. Check: `git diff -U0 docs/decisions.md` shows only
  added lines plus the refund and annotation rows; requirement "No decision changed". Requirement "Links resolve":
  all new relative links resolve.
- [x] 1.5 Open PR 1 to `develop`. Check: CI `pr-title`, `commits`, `branch-name`, `lint` green.

## Phase 2: PR 2, T1.1 (`feature/pnpm-workspace`, depends on PR 1 only for stack order)

Specs: workspace-toolchain.

- [x] 2.1 Create `.nvmrc` (`26.13.0`), `package.json` (`packageManager: pnpm@12.16.1`, root scripts per design),
  `pnpm-workspace.yaml` (`packages: [apps/*, packages/*]`, catalog with exact versions, all pnpm settings). Check:
  requirements "Single source of toolchain pins", "pnpm workspace with catalog"; `pnpm install --frozen-lockfile`
  passes on a clean clone (PLAN box 1).
- [x] 2.2 Create `tsconfig.base.json` with the strict flags listed in the design. Check: `rg '"strict": true'
  tsconfig.base.json`; requirement "Strict TypeScript base"; PLAN box 3.
- [x] 2.3 Create `biome.json` (includes, excludes, VCS ignore, width 120, single quotes) and `.env.example` (six empty
  keys). Add `.gitignore` entry `apps/docs/build/`. Check: `pnpm lint` passes and does not touch `.claude`,
  `openspec`, or Solidity; requirements "Biome and root scripts", "Environment template".
- [x] 2.4 Generate `pnpm-lock.yaml`. Check: `pnpm lint`, `pnpm typecheck`, `pnpm test` all run from the root with no
  workspaces yet (PLAN box 2).
- [x] 2.5 Open PR 2. Check: CI green (lint job covers JSON); the actionlint and SHA-pin check is unaffected.

## Phase 3: PR 3, T1.2 (`feature/commit-hooks`, depends on PR 2)

Specs: commit-gate.

- [x] 3.1 Add devDependencies `husky`, `@commitlint/cli`, `@commitlint/config-conventional` (catalog) and `prepare:
  husky`; create `.husky/commit-msg` (mode 755) running `pnpm exec commitlint --edit "$1"`. Check: `pnpm install`
  installs the hook (PLAN box 1); `stat -f %Lp .husky/commit-msg` is `755`.
- [x] 3.2 Hook verdicts. Check: `git commit --allow-empty -m 'bad message'` is rejected, also with `-a`;
  `chore(repo): add thing` accepted (threat matrix commit-state RED test). Never run with `--no-verify` except to
  confirm CI catches it on a throwaway branch.
- [x] 3.3 Document the commit-msg hook in `CONTRIBUTING.md`. Check: requirement "Hook documented".
- [x] 3.4 Open PR 3. Check: CI `commits` job stays green (requirement "CI commits job stays green"; PLAN box 3).

## Phase 4: PR 4, T1.3 (`feature/docusaurus-site`, depends on PR 2)

Specs: docs-site (build, links, diagrams, in place). Parallel with Phase 3 in authoring only; branches stay stacked.

- [ ] 4.1 Create `apps/docs/package.json` (every `@docusaurus/*` at `3.10.2` via catalog, react, mdx, clsx, prism),
  `tsconfig.json` (extends base and `@docusaurus/tsconfig`), `sidebars.ts`. Check: `pnpm install --frozen-lockfile`;
  if `tsc --noEmit` fails on TS 7, pin the latest 5.x for `apps/docs` only and note it in the PR.
- [ ] 4.2 Create `apps/docs/docusaurus.config.ts` per design (`docs.path: '../../docs'`, `routeBasePath: '/'`,
  `blog: false`, `url`, `baseUrl`, `markdown.format: 'detect'`, `mermaid: true`, throw on broken links and Markdown
  links, Mermaid themes, Prism `solidity` and `toml`, `future.v4: true`). Add `docs/README.md` with `slug: /`. Check:
  requirement "Docusaurus reads docs in place"; no file copied out of `docs/` (`git status` shows no duplicates;
  PLAN box 3).
- [ ] 4.3 Fix broken links in `docs/*.md` in place until `pnpm --filter docs build` passes. Check: PLAN box 1;
  requirement "Broken links fail the build"; probe: an uncommitted broken link makes the build fail, then remove it.
- [ ] 4.4 Threat probe: a `.md` file containing `{1+1}` renders literally. Check with `pnpm --filter docs serve`.
- [ ] 4.5 Render check in `serve`: Mermaid blocks render in light and dark themes, and all 5 Excalidraw SVGs in
  `docs/diagrams/` render (PLAN box 2; requirement "Diagrams render").
- [ ] 4.6 Open PR 4. Check: CI green; if the line count tops 400 because of link fixes, split link fixes into a
  preceding commit or PR (flag, do not exceed silently).

## Phase 5: PR 5, T1.4 (`feature/ci-workspace-jobs`, depends on PRs 2 and 4)

Specs: ci-workspace-jobs.

- [ ] 5.1 Resolve every new action SHA with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha` (tag as a trailing
  comment): `dorny/paths-filter`, `pnpm/action-setup`, `actions/setup-node`, `actions/upload-artifact`. Check:
  `rg -nP 'uses: [^#\s]+@(?![0-9a-f]{40}\b)' .github/workflows` finds nothing; requirement "Pinned actions and actionlint".
- [ ] 5.2 Extend `.github/workflows/ci.yml`: `changes` job (inline filters, root anchor, `docs`, `demo-3`), `biome`
  job, `docs-build` job (typecheck, build, PR artifact `docs-site`, 7 days), install steps per design, top-level
  `permissions: contents: read` (`changes` adds `pull-requests: read`), `timeout-minutes` on every job, shell inputs
  only through `env:`. Check: requirements "Path-filtered workspace jobs", "Reproducible installs", "Job limits and
  permissions"; PLAN boxes 1 and 2.
- [ ] 5.3 Add the `ci-gate` job exactly as in the design (`if: always()`, needs all jobs, `jq` over `toJSON(needs)`).
  Check: requirement "Aggregate gate".
- [ ] 5.4 Local static check: `actionlint` passes. Check: PLAN box 3.
- [ ] 5.5 CI probes. Check: a docs-only change gives a green gate with skipped jobs; a draft probe PR with a failing
  job makes `ci-gate` red; the threat-matrix title `x"; echo pwned; "` fails format and the log has no `pwned`.
- [ ] 5.6 Open PR 5. Check: `ci-gate` appears and is green.
- [ ] 5.7 OPERATIONAL, needs develop merged: after PR 5 is merged, confirm `ci-gate` ran green on `develop`
  (`gh run list --branch develop --workflow ci.yml`). This unblocks task 6.4.

## Phase 6: PR 6, T1.5 (`feature/branch-rulesets`, depends on PR 5)

Specs: branch-policy.

- [ ] 6.1 Export live rulesets verbatim: `gh api repos/<owner>/<repo>/rulesets/26496788` and `/26496789` into
  `.github/rulesets/develop.json` and `main.json` (fields `name, target, enforcement, conditions, bypass_actors,
  rules`). Commit 1 is the verbatim export. Check: requirement "Rulesets as code"; resolves the open question on live
  JSON.
- [ ] 6.2 Commit 2: set `required_status_checks` to `ci-gate` only, keeping any live `integration_id`; change
  nothing else. Check: `jq -S` diff of the two files against the export shows only that rule.
- [ ] 6.3 Create `.github/CODEOWNERS` (`* @sebastianlujan`) and document export, `jq -S` semantic diff, and
  `gh api -X PUT repos/<owner>/<repo>/rulesets/<id> --input <file>` in `CONTRIBUTING.md`. Check: requirements
  "CODEOWNERS", "Apply command documented"; PLAN box 3.
- [ ] 6.4 OPERATIONAL, needs develop merged and `ci-gate` green on `develop` (task 5.7) and PR 6 merged: apply both
  rulesets with the documented PUT command. Check: empty `jq -S` diff between live and committed JSON;
  `gh api repos/<owner>/<repo>/rules/branches/develop` lists `ci-gate`; requirement "PRs need green checks, no force
  push or deletion"; PLAN box 1.
- [ ] 6.5 Threat probes, only as a non-bypass actor: `git push origin HEAD:develop`, `--force`, and `:develop` are
  rejected. Check: requirement "Direct pushes rejected"; PLAN box 2.
- [ ] 6.6 Open PR 6. Check: CI green. Never apply rulesets before task 5.7, or every PR waits on a missing check.

## Phase 7: PR 7, T1.6 (`feature/docs-deploy`, depends on PRs 4 and 5)

Specs: docs-site (deploy, artifact, setup documented).

- [ ] 7.1 OPERATIONAL, admin, before PR 7 merges (needs repo admin; no develop merge required): `POST /pages` with
  `build_type=workflow`; `PUT /environments/github-pages` with `custom_branch_policies: true`; `POST
  .../deployment-branch-policies` with `name=main`; delete any other policy. Check: `gh api
  repos/<owner>/<repo>/environments/github-pages/deployment-branch-policies` lists only `main`.
- [ ] 7.2 Create `.github/workflows/docs-deploy.yml` per design (push to `main` and `workflow_dispatch`, `permissions:
  {}`, concurrency `pages` without cancel, `build` with `upload-pages-artifact`, `deploy` guarded on ref `main` with
  `pages: write`, `id-token: write`, environment `github-pages`, SHA-pinned actions). Check: `actionlint`; SHA-pin
  `rg` check; requirement "Pages deploy from main".
- [ ] 7.3 Document the "github-pages" setup steps in `CONTRIBUTING.md`. Check: requirement "Pages setup documented".
- [ ] 7.4 Open PR 7. Check: PR run attaches the `docs-site` artifact (PLAN box 3; requirement "PR site artifact");
  `docs-deploy` does not run on PRs.

## Phase 8: Release and publish (needs develop merged with PRs 1 to 7)

- [ ] 8.1 OPERATIONAL, needs develop merged (all of PRs 1 to 7) and rulesets applied: cut `release/0.1.0` from
  `develop` and open the PR into `main` per CONTRIBUTING (user approved). Check: `ci-gate` green on the release PR.
- [ ] 8.2 After the user merges to `main`, confirm the `docs-deploy` run succeeds. Check: the site serves `/PLAN`
  at `https://sebastianlujan.github.io/hackatwin-x402-team1-avalanche/PLAN` (PLAN box 1; requirement "Pages deploy
  from main").
- [ ] 8.3 Re-run the deploy (`gh run rerun`). Check: the re-run stays green (idempotent; PLAN box 2).
- [ ] 8.4 Back-merge `main` into `develop` per CONTRIBUTING if the flow requires it, then check the Success Criteria
  list in the proposal: bad PR title fails CI and a good one passes; a bad local commit is rejected; the Pages site
  shows `docs/PLAN.md`; direct pushes to `develop` and `main` are rejected.

## Dependency summary

- Sequential chain: Phase 1 then 2 then 3 then 4 then 5 then 6 then 7 then 8 (stacked branches, each from the previous).
- Logical dependencies from PLAN: T1.2 and T1.3 need T1.1; T1.4 needs T1.1 and T1.3; T1.5 needs T1.4; T1.6 needs
  T1.3 and T1.4; T1.7 has none (placed first by design).
- Authoring can overlap (T1.2 with T1.3), but PRs open in chain order; admin steps 7.1 can be done any time before
  PR 7 merges.
- Bottlenecks: each user merge gates the next rebase (0.2); 6.4 and 8.1 need earlier merges plus admin rights.
