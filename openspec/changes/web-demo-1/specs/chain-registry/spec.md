# Delta for Chain Registry

Base: shared-packages `chain-registry` plus the contracts delta (not yet archived). Checked: no base requirement changes
(the contracts delta only modifies "Forge reader"), and the names below do not collide with any base requirement, so
ADDED is used. Registry JSON and the root `@hackatwin/chains` index are unchanged.

## ADDED Requirements

### Requirement: Transaction explorer URL

`packages/chains` MUST export a helper that returns the explorer URL of a tx hash for a chain key. It MUST return a URL
only for `read-write` chains, derived from viem chain data, and `undefined` for `fork-only` chains (including `cchain`),
for chains without a known explorer, and for a hash that is not `0x` plus 64 hex characters.

#### Scenario: Fuji

- GIVEN chain key `fuji` and a valid hash
- WHEN the helper runs
- THEN it returns the Fuji explorer `/tx/<hash>` URL

#### Scenario: Fork

- GIVEN chain key `cchain` (fork-only) and a valid hash
- WHEN the helper runs
- THEN it returns `undefined`

#### Scenario: Bad hash

- GIVEN a malformed hash
- WHEN the helper runs
- THEN it returns `undefined`

### Requirement: Browser-safe entry point

`packages/chains` MUST expose the subpath `@hackatwin/chains/registry`, which exports only the registry and the explorer helper, with no `node:*` import
in its module graph. The root index MUST keep its current exports.

#### Scenario: Import graph

- GIVEN the subpath entry file
- WHEN its transitive imports are listed
- THEN none starts with `node:` and none reaches `anvil` or `keystore` code

#### Scenario: Root unchanged

- GIVEN the root index exports before and after
- WHEN compared
- THEN every previous export remains

#### Scenario: Registry untouched

- GIVEN the registry JSON files
- WHEN diffed against the base
- THEN they are identical

## Traceability

| Done-when box | Requirement |
|---|---|
| The explorer URL comes from `packages/chains` (T10.4) | Transaction explorer URL |
| Fork tx hashes show without explorer links (T10.6) | Transaction explorer URL (undefined for fork-only) |
| Secrets never reach the client bundle (T10.2) | Browser-safe entry point |
