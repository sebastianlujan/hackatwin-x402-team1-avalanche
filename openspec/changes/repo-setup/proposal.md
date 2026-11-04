# Proposal: Repo setup (M1)

## Intent

`develop` holds only the initial commit: no workspace, local commit gate, docs site, per-workspace CI, codified
branch policy, or docs hosting. M1 gates every PR and makes the docs browsable before app code lands; M2 to M13
build on it.

Proposal round: R1 scope is exactly T1.1 to T1.7; R2 Biome for TypeScript, Solidity tooling per C4; R3 Pages from
`main` with a PR artifact, hosting stays with O9.

## Scope

### In Scope

| Task | Deliverable |
|---|---|
| T1.1 | pnpm workspace, pinned Node and pnpm, catalog, strict TS base, Biome, root scripts, `.env.example` |
| T1.2 | husky commit-msg hook running `commitlint.config.mjs` |
| T1.3 | Docusaurus at `apps/docs` reading `../../docs`, Mermaid, `onBrokenLinks: 'throw'` |
| T1.4 | Path-filtered workspace jobs in `ci.yml`, SHA pins, timeouts, least privilege, actionlint |
| T1.5 | `.github/rulesets/` JSON for rulesets 26496788 and 26496789, `CODEOWNERS`, apply command |
| T1.6 | Pages deploy from `main` with OIDC; PR site artifact |
| T1.7 | Step 0 drift in `docs/decisions.md`, no decision changed |

### Out of Scope

- Devcontainer (M2, Q9), scaffolds and DI (M3), contracts.
- Preview or staging hosting (O9).
- Changing the live ruleset policy.

## Capabilities

### New Capabilities

- `workspace-toolchain`: pins, workspace, strict TS, Biome, root scripts.
- `commit-gate`: local commit-msg check matching CI.
- `docs-site`: build from `docs/`, link check, rendering, Pages deploy, PR artifact.
- `ci-workspace-jobs`: path filters, aggregate gate, hardening.
- `branch-policy`: rulesets as code, CODEOWNERS, documented apply.
- `decision-log`: drift record in `docs/decisions.md`.

### Modified Capabilities

None (`openspec/specs/` is empty).

## Approach

- One PR per task, PLAN branch names, under 400 authored lines; `pnpm-lock.yaml` counts as generated.
- Base: a branch on `feature/implementation-plan` merged with `feature/ci-pipeline`. Order: T1.7, T1.1, T1.2,
  T1.3, T1.4, T1.5, T1.6; `sdd-tasks` fixes the chain shape.
- Rulesets require one aggregate CI job, so skipped path-filtered jobs never block.
- Docusaurus uses `markdown.format: 'detect'`; broken links are fixed in place, nothing is copied out of `docs/`.
- No contracts, so strict TDD does not apply (Q21); CI jobs and PLAN "Done when" boxes verify.

## Affected Areas

| Area | Impact |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.nvmrc`, `.env.example`, `.husky/` | New |
| `apps/docs/` | New |
| `.github/workflows/`, `.github/rulesets/`, `.github/CODEOWNERS` | New/Modified |
| `CONTRIBUTING.md`, `docs/decisions.md`, links in `docs/*.md` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Squash merges of #3, #5, #7, #9 pollute stacked diffs | High | Rebase or retarget children after each merge |
| Pages needs repo settings; `github-pages` environment may allow only the default branch | Med | Enable via `gh api`, allow `main`, document it |
| First publish waits for a `main` update | High | `workflow_dispatch`; PR artifact meanwhile |
| Existing docs fail MDX parsing or link checks | Med | `format: 'detect'`, fix links |
| Node and pnpm pins drift across local, CI, devcontainer | Med | `packageManager` and `.nvmrc` as the only source |
| Ruleset JSON drifts from live | Low | Export with `gh api`, diff before apply |

## Rollback Plan

Revert the task's squash commit on `develop`. Rulesets: re-apply the exported JSON. Pages: disable in settings (no
consumers yet).

## Dependencies

- PRs #3, #5, #7, #9 merged by the user.
- Admin access for rulesets and Pages.

## Success Criteria

- [ ] Every PLAN "Done when" box for T1.1 to T1.7 passes.
- [ ] A bad PR title fails CI and a good one passes; a bad local commit is rejected.
- [ ] The Pages site shows `docs/PLAN.md`.
- [ ] Direct pushes to `develop` and `main` are rejected.

## Decision IDs

C4, Q3, Q9, Q21, O9; PLAN Step 0 and § 5.6.
