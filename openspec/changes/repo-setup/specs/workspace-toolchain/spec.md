# Delta for workspace-toolchain

## ADDED Requirements

### Requirement: Single source of toolchain pins

Node MUST be pinned in `.nvmrc` and pnpm in the root `packageManager` field. No other file MAY declare a different
version of either.

#### Scenario: Pins present

- Given a fresh checkout of the T1.1 branch
- When `.nvmrc` and `package.json` are read
- Then `.nvmrc` holds an exact Node version and `packageManager` holds an exact `pnpm@x.y.z`

#### Scenario: CI reads the same pins

- Given the CI workflows
- When the Node and pnpm setup steps are inspected
- Then versions come from `.nvmrc` and `packageManager`, not a literal

### Requirement: pnpm workspace with catalog

`pnpm-workspace.yaml` MUST define workspace globs and a `catalog:` of exact shared versions.

#### Scenario: Frozen install on a clean clone

- Given a clean clone
- When `pnpm install --frozen-lockfile` runs
- Then it exits 0 and `pnpm-lock.yaml` is unchanged

#### Scenario: Stale lockfile

- Given `package.json` changed without a lockfile update
- When `pnpm install --frozen-lockfile` runs
- Then it exits non-zero

### Requirement: Strict TypeScript base

`tsconfig.base.json` MUST set `compilerOptions.strict` to `true`.

#### Scenario: Strict on

- Given `tsconfig.base.json`
- When parsed
- Then `compilerOptions.strict` is `true`

### Requirement: Biome and root scripts

Biome MUST provide format and lint. The root `package.json` MUST expose `lint`, `typecheck`, `test`, and `build`,
and the first three MUST run from the repo root.

#### Scenario: Root scripts run

- Given a clean install
- When `pnpm lint`, `pnpm typecheck`, and `pnpm test` run from the root
- Then each exits 0

#### Scenario: Lint violation

- Given a TypeScript file with a Biome error
- When `pnpm lint` runs
- Then it exits non-zero

### Requirement: Environment template

`.env.example` MUST exist with variable names and no secret values, and `.env` MUST be git-ignored.

#### Scenario: Template present and clean

- Given the T1.1 branch
- When `.env.example` is read
- Then it exists and every value is empty or a documented placeholder

## Traceability

| PLAN T1.1 checkbox | Requirement |
|---|---|
| `pnpm install --frozen-lockfile` passes on a clean clone | pnpm workspace with catalog; Single source of toolchain pins |
| `pnpm lint`, `typecheck`, `test` run from the root | Biome and root scripts |
| `tsconfig.base.json` sets `strict: true` and `.env.example` exists | Strict TypeScript base; Environment template |
