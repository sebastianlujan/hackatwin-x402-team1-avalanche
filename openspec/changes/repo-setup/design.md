# Design: Repo setup (M1)

## Technical Approach

Root tooling and delivery around the `ci.yml` from PR #5, with no product decision changed. One pnpm workspace whose
only M1 package is `apps/docs`. New CI jobs are path-filtered and all feed one gate; rulesets require only the gate.
Docs deploy only from `main`. M1 ships no runtime code, so hexagonal and DI rules start in M3. Rationale lives in the
[ADRs](../../../docs/adr/README.md); this file holds the concrete values for the six specs.

## Architecture Decisions

| Area | Choice | Rejected (why) | Ref |
|---|---|---|---|
| TS lint and format | Biome, one root config | ESLint + Prettier (two tools) | ADR 0001 |
| Required checks | `ci-gate` only | Every job (names drift, skips pass) | ADR 0002 |
| Docs source | Docusaurus reads `../../docs` | Copy or sync (drift) | ADR 0003 |
| Docs hosting | Pages from `main`, PR artifact | `develop` (unreleased docs) | ADR 0004 |
| Pages environment | Custom branch policy, `main` only | Protected branches (admits `develop`) | ADR 0004 |
| Version pins | `.nvmrc` and `packageManager`; CI reads both | Literals in workflows | spec |
| Commitlint in CI | `pr-title` and `commits` run `pnpm exec commitlint` | Action with bundled commitlint (version skew) | spec |
| Workspace jobs | M1: one `docs-build` job; a matrix keyed by filter name arrives with the second workspace (M3) | Matrix over workspaces that do not exist | YAGNI |

## Concrete Values

| Item | Value |
|---|---|
| Node | `26.13.0` in `.nvmrc` (Active LTS "Lithium", verified 2026-11-04) |
| pnpm | `packageManager: pnpm@12.16.1` (verified); every setting lives in `pnpm-workspace.yaml` |
| Tool pins | `@biomejs/biome@2.6.4`, `husky@9.1.7`, `typescript@7.0.2` (verified); if Docusaurus typecheck fails on TS 7, pin the latest 5.x for `apps/docs` only |
| Workspace | `packages: [apps/*, packages/*]`; M3 adds `demos` and `e2e` globs |
| Catalog | Exact versions of `typescript`, `@biomejs/biome`, `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, every `@docusaurus/*` (one version), `react`, `react-dom`, `@mdx-js/react`, `clsx`, `prism-react-renderer` |
| Root scripts | `prepare: husky`; `lint: biome check .`; `format: biome check --write .`; `typecheck`, `test`, `build`: `pnpm -r --if-present <name>` |
| `tsconfig.base.json` | `ES2023`, `NodeNext`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck` |
| `biome.json` | Includes `**/*.{ts,tsx,js,mjs,cjs,json,jsonc,css}`; excludes `.claude`, `openspec`, build output; Solidity never matched; VCS ignore on; width 120, single quotes, recommended rules |
| `.env.example` | Empty `ANTHROPIC_API_KEY`, `CCHAIN_RPC_URL`, `FUJI_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`; M3 config schemas own the names |
| Hook | `.husky/commit-msg` (mode 755): `pnpm exec commitlint --edit "$1"`; `CONTRIBUTING.md` documents the commit-msg hook |
| Docs path | `docs.path: '../../docs'` (content stays in `docs/`, nothing copied) |
| Docusaurus | `3.10.2` for every `@docusaurus/*` (verified); config on the 3.9+ API with `future.v4: true` |
| Site | `url: https://sebastianlujan.github.io`, `baseUrl: /hackatwin-x402-team1-avalanche/`; docs-only (`routeBasePath: '/'`, `blog: false`); new `docs/README.md` with `slug: /` |
| Markdown | `format: 'detect'`, `mermaid: true`, `hooks.onBrokenMarkdownLinks: 'throw'`; `onBrokenLinks: 'throw'`; Mermaid themes `neutral` and `dark`; Prism adds `solidity`, `toml` |
| Excalidraw SVGs | Referenced as Markdown images from `docs/diagrams/*.svg`; the build fails on a missing image, and the serve check confirms all 5 render |
| Docs TS | `extends: ["../../tsconfig.base.json", "@docusaurus/tsconfig"]`; `typecheck: tsc --noEmit` |

## Data Flow

```
pull_request ─┬─ pr-title, commits, branch-name, lint (existing) ─┐
              ├─ biome ───────────────────────────────────────────┼─→ ci-gate ─→ rulesets
              └─ changes ─→ docs-build ─→ artifact docs-site ─────┘
push main | dispatch ─→ docs-deploy: build ─→ deploy (github-pages, OIDC) ─→ Pages
```

## Interfaces / Contracts

**CI (T1.4).** Existing job ids stay. `changes` runs `dorny/paths-filter` with inline filters; `docs` = root anchor
(`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.nvmrc`, `ci.yml`) plus
`docs/**` and `apps/docs/**`. Later filters reuse the anchor; `demo-3` adds demos 01 to 03 and `packages/**`. Node jobs
run checkout (`persist-credentials: false`), `pnpm/action-setup` without a version, `setup-node` with
`node-version-file: .nvmrc` and `cache: pnpm`, then `pnpm install --frozen-lockfile`. `docs-build` runs typecheck and
build, and on PRs uploads `apps/docs/build` as `docs-site` (7 days). Top-level `permissions: contents: read`; `changes`
adds `pull-requests: read`. Every job sets `timeout-minutes`. PR title and branch reach shells only through `env:`.
SHAs come from `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`, with the tag as a trailing comment.

```yaml
ci-gate:
  if: always()
  needs: [pr-title, commits, branch-name, lint, biome, changes, docs-build]
  runs-on: ubuntu-latest
  timeout-minutes: 5
  permissions: {}
  steps:
    - env:
        NEEDS: ${{ toJSON(needs) }}
      run: jq -e 'all(.[]; .result == "success" or .result == "skipped")' <<< "$NEEDS"
```

**Rulesets (T1.5).** `.github/rulesets/develop.json` (26496788) and `main.json` (26496789) hold
`name, target, enforcement, conditions, bypass_actors, rules`. Commit 1 is the verbatim `gh api` export. Commit 2 sets
`required_status_checks` to `ci-gate` only, keeping any live `integration_id`; nothing else changes. This is not a
policy change: `ci-gate` requires the same four checks plus the new jobs. `CONTRIBUTING.md`
documents export, a `jq -S` semantic diff, and `gh api -X PUT repos/<owner>/<repo>/rulesets/<id> --input <file>`.
`CODEOWNERS`: `* @sebastianlujan`.

**Deploy (T1.6).** `docs-deploy.yml`: push to `main` and `workflow_dispatch`; `permissions: {}`; concurrency `pages`
without cancel; `build` (`contents: read`) runs `upload-pages-artifact`; `deploy` (ref must be `main`; `pages: write`,
`id-token: write`; environment `github-pages`) runs `deploy-pages`. One-time admin setup, documented under
"github-pages" in `CONTRIBUTING.md`: `POST /pages` with `build_type=workflow`; `PUT /environments/github-pages` with
`custom_branch_policies: true`; `POST .../deployment-branch-policies` with `name=main`; delete any other policy.

**Drift (T1.7).** `docs/decisions.md` gains `### Drift log (2026-11-04)` after Open points, with the six PLAN Step 0
rows (CCIP `MAINTENANCE`, validator `v1.15.2`, C-Chain execution (Helicon, pick `N` behind the head, T5.1), ICM
license and O7, backup RPC, x402-rs), each linking to PLAN Step 0. The refund open point is closed with links to
`standards/smart-contracts.md#2-state-pattern` and the verified ICTT allowance sweep to `fallbackRecipient`; ICM license
and backup RPC are annotated. A pointer records that the overview label fix is tracked by T3.5. Still-unverified items
stay unverified. No decision, value, or address line changes. One pointer line links `adr/README.md`.

## File Changes

| File | Action |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.base.json`, `biome.json`, `.env.example`, `.husky/commit-msg` | Create |
| `apps/docs/{package.json,docusaurus.config.ts,sidebars.ts,tsconfig.json}`, `docs/README.md` | Create |
| `.github/workflows/docs-deploy.yml`, `.github/rulesets/{develop,main}.json`, `.github/CODEOWNERS` | Create |
| `docs/adr/README.md`, `docs/adr/0001` to `0004` | Created in this phase |
| `.github/workflows/ci.yml`, `CONTRIBUTING.md`, `docs/decisions.md`, `.gitignore` (`apps/docs/build/`) | Modify |

## Testing Strategy

| Layer | Check |
|---|---|
| Static | actionlint; `rg -nP 'uses: [^#\s]+@(?![0-9a-f]{40}\b)' .github/workflows` finds nothing |
| Toolchain | Clean clone: frozen install, then `pnpm lint`, `typecheck`, `test`, `build` |
| Hook | `bad message` rejected, `chore(repo): add thing` accepted, same verdicts in CI |
| Docs | `pnpm --filter docs build`; an uncommitted broken-link probe fails; Mermaid checked in `serve` |
| CI | Docs-only PR: gate green with skips; draft probe PR with a failing job: gate red |
| Policy | Empty `jq -S` diff; `gh api repos/<owner>/<repo>/rules/branches/develop` |
| Deploy | First `main` deploy serves `/PLAN`; a re-run stays green |

Strict TDD does not apply (Q21).

## Threat Matrix

| Boundary | Applicability | Response | RED test |
|---|---|---|---|
| Documentation-like paths | Applicable: the build parses `docs/` | `.md` is CommonMark, so no JSX runs; PR CI uses `pull_request` (no secrets), never `pull_request_target` | A `.md` probe with `{1+1}` renders literally |
| Git repository selection | N/A: hooks and jobs act on the checked-out repo only | None | None |
| Commit state | Applicable: commit-msg hook | Lints the message for staged, `-a`, and empty commits; `--no-verify` is caught by CI `commits` | Bad message rejected with `--allow-empty` and with `-a` |
| Push state | Applicable: rulesets | Enforced server-side for any refspec | `push origin HEAD:develop`, `--force`, and `:develop` rejected; run only as a non-bypass actor |
| PR commands | Applicable: PR title and branch reach shells | `env:` only; actionlint flags inline untrusted input | Title `x"; echo pwned; "` fails format and the log has no `pwned` |

## Migration / Rollout

1. ADRs ride with T1.7 (first, docs-only PR) unless `sdd-tasks` splits them per task.
2. Apply rulesets only after `ci-gate` runs green on `develop`; earlier, every PR waits on a missing check.
3. Run the Pages setup before T1.6 merges.
4. `workflow_dispatch` uses the workflow file of the chosen ref, so the first publish is the first release merge to
   `main`.

Rollback: as in the proposal.

## Open Questions

- [x] Cut `release/0.1.0` right after M1 so the site publishes: yes (the user wants to see it working).
- [x] Code owners: only `@sebastianlujan` for now.
- [x] Verified by the orchestrator: versions above; `ci.yml` job ids are `pr-title`, `commits`, `branch-name`, `lint`
  (`lint` runs actionlint and `jq` over tracked JSON and `.excalidraw`); Dependabot already exists in PR #5 targeting
  `develop`, and the branch-name check already allows `dependabot/*`, so it is not deferred.
- [ ] Live ruleset JSON: apply exports it first (`gh api .../rulesets/26496788` and `/26496789`).
