---
title: 'ADR 0005: Config package outside core'
---

# ADR 0005: Config package outside core

## Status

Accepted, 2026-11-04 (M3, T3.1 and T3.4).

## Context

[PLAN § 2](../PLAN.md#2-repository-structure) puts the config schemas in `packages/core`, and M3 requires core to have
no runtime dependencies. Profiles are validated with zod in the composition root and registered as a token
([PLAN § 5.2](../PLAN.md#52-di-open-points)). Zod in core breaks the zero-dependency rule, and validating the
environment by hand duplicates zod with weaker errors. Composition roots must not read the environment ad hoc
([Q1](../decisions.md#decision-log)).

## Decision

- A new workspace, `packages/config` (`@hackatwin/config`), depends on `@hackatwin/core` and `zod`. It holds the
  schemas for the five profiles (`cchain-fork`, `fuji-crosschain`, `twinpay-l1`, `fuji-cchain`,
  `local-crosschain`) and `loadProfile(name, env = process.env)`.
- `loadProfile` is the only code that reads `process.env`. Composition roots call it once and register the result;
  tests pass a plain record.
- Core keeps the container, domain types, ports, and fakes, and declares no `dependencies`. The dependency-rule test
  enforces both rules.
- Profiles name keystores and password files, never keys.

Rejected: zod in core (breaks the zero-dependency rule, and every port consumer inherits zod); hand-written validation
in core (duplicates zod, more code to test, poorer errors); schemas per composition root (the same profile drifts
between roots).

## Consequences

- Composition roots depend on `@hackatwin/config` and `@hackatwin/core`. Modules and adapters receive typed config,
  never the environment.
- PLAN § 2 and the README layout gain `packages/config`, and core no longer lists config schemas.
- Demo 3's `defineDemo3Config` (T9.1) reuses the config enums, and the T9.2 dependency test allows modules, core, and
  config.
- A zod or TypeScript upgrade touches one package. If TypeScript 7 rejects zod's types, only `packages/config` pins
  TypeScript 5.x, as `apps/docs` already does.
