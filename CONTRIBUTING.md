# Contributing

## Flow

**Issue → branch → commits → PR → merge.** No issue, no branch. Use the `Task` or `Bug` issue form.

## Branches (gitflow)

- `main`: releases, tagged. `develop`: integration. No direct pushes to either.
- `feature/<name>` (kebab-case) from `develop` → PR into `develop`.
- `release/x.y.z` from `develop` → PR into `main`, then back into `develop`.
- `hotfix/<name>` from `main` → PR into `main`, then back into `develop`.
- CI must be green before merging. Branch names are checked in CI.

## Commits

[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), in English, with a module scope and
the issue in the footer:

```
feat(agent-kit): add x402 client adapter

Refs #12
```

`pnpm install` sets up a `commit-msg` hook that runs commitlint with the same config as CI, so a bad message is
rejected locally. CI still checks every commit, including ones made with `--no-verify`.

## Pull requests

English, one issue each, small. The body follows the template and says `Closes #12`. Squash merge into `develop`.

## Rulesets

Branch policy lives in `.github/rulesets/` (`develop.json`, `main.json`) and requires only the `ci-gate` check.
`.github/CODEOWNERS` sets the default owner. Needs repo admin.

```sh
R=sebastianlujan/hackatwin-x402-team1-avalanche
# export a live ruleset (ids: develop 26496788, main 26496789)
gh api repos/$R/rulesets/26496788 | jq '{name,target,enforcement,conditions,bypass_actors,rules}' > .github/rulesets/develop.json
# semantic diff between live and committed
diff <(jq -S . .github/rulesets/develop.json) <(gh api repos/$R/rulesets/26496788 | jq -S '{name,target,enforcement,conditions,bypass_actors,rules}')
# apply
gh api -X PUT repos/$R/rulesets/26496788 --input .github/rulesets/develop.json
```

Apply only after `ci-gate` has run green on `develop`, or every PR waits on a missing check. Repeat with `main.json`
and id `26496789`.

## No AI attribution

No AI attribution in commits, PRs, issues, or code: no `Co-Authored-By` trailers, no "Generated with ..." footers,
no AI credits.

## Principles

KISS, DRY, YAGNI. Less is more.

## Comments

Hard rule for code: a comment is one line and simple. If it can't be, don't write it.
