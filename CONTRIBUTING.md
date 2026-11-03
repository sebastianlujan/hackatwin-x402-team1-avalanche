# Contributing

## Flow

**Issue → branch → commits → PR → merge.** No issue, no branch. Use the `Task` or `Bug` issue form.

## Branches (gitflow)

- `main`: releases, tagged. `develop`: integration. No direct pushes to either.
- `feature/<issue>-<slug>`, `release/x.y.z`, `hotfix/<issue>-<slug>`.
- PRs target `develop`. Release and hotfix branches merge into `main`.

## Commits

[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), in English, with a module scope and
the issue in the footer:

```
feat(agent-kit): add x402 client adapter

Refs #12
```

## Pull requests

English, one issue each, small. The body follows the template and says `Closes #12`. Squash merge into `develop`.

## No AI attribution

No AI attribution in commits, PRs, issues, or code: no `Co-Authored-By` trailers, no "Generated with ..." footers,
no AI credits.

## Principles

KISS · DRY · YAGNI. Less is more.
