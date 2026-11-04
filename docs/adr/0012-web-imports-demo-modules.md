---
title: 'ADR 0012: The web server imports demo modules through module only'
---

# ADR 0012: The web server imports demo modules through module only

## Status

Accepted, 2026-11-04 (M10, T10.5).

## Context

The web server is a composition root (PLAN section 1.3): it wires a demo module and runs it. Rule R2 forbids apps and
packages from importing demos, so the web cannot call Demo 1's run entry as written.

## Decision

- The `apps/web` manifest may depend on `@hackatwin/demo-*`. Only files under `apps/web/src/server/**` that import
  `server-only` may import `@hackatwin/demo-*/module`, and only that entry.
- Every other `apps/web` file fails R2, as do deep and relative demo imports. Client files also fail R11.
- Each demo's `module` export is its barrel: registration plus one run entry. The web calls the run entry per run.

Rejected: copying Demo 1's composition into the web (two roots drift, and keystore and guard logic is duplicated);
spawning `pnpm demo1` and parsing stdout (a second schema and process management).

## Consequences

- Demo internals stay private; other apps and packages keep R2.
- The run entry owns preflight and the fork guard, so the web inherits both without reimplementing them.
