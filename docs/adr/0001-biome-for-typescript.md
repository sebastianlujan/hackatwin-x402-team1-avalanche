---
title: 'ADR 0001: Biome for TypeScript'
---

# ADR 0001: Biome for TypeScript

## Status

Accepted, 2026-11-04 (M1, T1.1).

## Context

TypeScript workspaces land from M3. They need one formatter and one linter that behave the same locally and in CI.
Solidity already has its own tools, `forge fmt` and `solhint-config-wonderland`
([Smart contract standards](../standards/smart-contracts.md#3-code-standards), C4).
[PLAN § 5.6](../PLAN.md#56-tooling-choices) lists Biome.

## Decision

Biome formats and lints TypeScript, JavaScript, JSON, and CSS from one root `biome.json`:

- Recommended rules, 2-space indent, line width 120, single quotes (the same width and quotes as `forge fmt`).
- Files are selected by extension. `.claude/`, `openspec/`, and build output are excluded. Solidity and Markdown are
  never matched.
- `pnpm lint` runs `biome check .`; CI runs `biome ci .`.

Rejected: ESLint plus Prettier (two tools, two configs, plugin version drift).

## Consequences

- One pinned devDependency from the pnpm catalog, no plugin graph, fast runs.
- No ESLint plugin ecosystem. Type-aware checks come from `tsc --noEmit` only.
- Editors use the Biome extension instead of ESLint and Prettier.
