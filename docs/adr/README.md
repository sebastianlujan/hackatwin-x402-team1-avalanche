---
title: Architecture decision records
sidebar_position: 5
---

# Architecture decision records

Repository and delivery decisions, one file each (Status, Context, Decision, Consequences). Product and architecture
decisions stay in [Decisions](../decisions.md).

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-biome-for-typescript.md) | Biome lints and formats TypeScript | Accepted |
| [0002](0002-aggregate-ci-gate.md) | One aggregate CI job is the only required check | Accepted |
| [0003](0003-docusaurus-reads-docs-in-place.md) | Docusaurus builds the site from `docs/` in place | Accepted |
| [0004](0004-docs-deploy-from-main.md) | Docs deploy to GitHub Pages from `main` only | Accepted |
| [0005](0005-config-package-outside-core.md) | Profile schemas and the env loader live in `packages/config`, not core | Accepted |
| [0006](0006-block-pinned-chain-reads.md) | Chain reads return their block and can be pinned to one | Accepted |

## Add an ADR

1. Copy an existing ADR and take the next number.
2. Keep the four sections short and link to [Decisions](../decisions.md) instead of repeating it.
3. Add a row here in the same PR as the change it records.
4. To replace a decision, add a new ADR and set the old status to `Superseded by NNNN`.
