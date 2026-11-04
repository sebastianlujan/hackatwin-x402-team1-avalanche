---
title: 'ADR 0002: One aggregate CI gate'
---

# ADR 0002: One aggregate CI gate

## Status

Accepted, 2026-11-04 (M1, T1.4 and T1.5).

## Context

Rulesets 26496788 (`develop`) and 26496789 (`main`) require four checks by job name. M1 adds path-filtered jobs, and
later milestones add many more. Required checks match by name, so every new, renamed, or matrix job would mean editing
both rulesets. A job skipped because a job it needs failed reports success, and a required workflow that never starts
leaves the PR waiting.

## Decision

`ci.yml` ends with a `ci-gate` job that runs with `if: always()`, needs every other job, and passes only when each
result is `success` or `skipped`. Both rulesets require only `ci-gate`. The pull request, merge method, force-push, and
deletion rules stay as they are.

Rejected: requiring every job (names drift, two rulesets to edit per job); workflow-level `paths` filters (a required
workflow that never starts blocks the PR); a third-party "all green" action (a dependency for one `jq` line).

## Consequences

- Adding, renaming, or path-filtering jobs never touches the rulesets.
- A job missing from `needs` is not enforced, so reviewers check `needs` whenever a job is added.
- The rulesets switch only after `ci-gate` has run green on `develop`. Switching earlier blocks every PR on a check that
  never reports.
