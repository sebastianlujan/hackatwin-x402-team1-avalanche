---
title: 'ADR 0004: Docs deploy from main'
---

# ADR 0004: Docs deploy from `main`

## Status

Accepted, 2026-11-04 (M1, T1.6).

## Context

Under gitflow, `main` receives only release and hotfix merges, and `develop` is the default branch. Preview and staging
hosting is still open ([PLAN O9](../PLAN.md#8-open-questions)). Enabling Pages creates a `github-pages` environment
whose branch rule may admit only the default branch.

## Decision

- `docs-deploy.yml` runs on push to `main` and on `workflow_dispatch`. A `build` job with `contents: read` uploads the
  site with `actions/upload-pages-artifact`. A `deploy` job with `pages: write` and `id-token: write` publishes it with
  `actions/deploy-pages` (OIDC, no stored token). Deployments share one concurrency group and are never cancelled.
- The `github-pages` environment allows exactly one branch: `main`.
- Pull requests that touch docs upload the built site as a CI artifact until O9 picks a preview host.

Rejected: deploying from `develop` (publishes unreleased docs and breaks "main is production"); a `gh-pages` branch
pushed with a token (long-lived write credential); allowing all protected branches (also admits `develop`).

## Consequences

- The public site matches the latest release, and re-running a deploy republishes the same build.
- `workflow_dispatch` runs the workflow file of the chosen ref, so nothing publishes until a release puts `apps/docs`
  and the workflow on `main`.
- Reviewers download the PR artifact to see a docs change rendered.
