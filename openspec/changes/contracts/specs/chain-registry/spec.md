# Delta for Chain Registry

Base: shared-packages `chain-registry` (not yet archived). Only the requirement below changes.

## MODIFIED Requirements

### Requirement: Forge reader (deferred)

A forge script library reading the per-chain JSON with `vm.parseJson` MUST ship in `packages/contracts` (M4 PR 10, after T7.1). It MUST map `block.chainid` to a registry key, read addresses by `(key, entry)`, and parse the string `ccip.chainSelector` into a `uint64`. A missing chain, entry, or selector MUST revert with a named error. File access MUST be read-only and scoped to the registry directory. The TypeScript reader stays authoritative for the TypeScript side; M4 itself MUST NOT add a Foundry harness.
(Previously: SHALL be delivered after T7.1 and tracked open by PR 10; scenario "Deferred box" held the T4.1 forge box open until T7.1 merged.)

#### Scenario: Deferred box
- GIVEN T7.1 is merged and the forge reader is delivered
- WHEN M4 completes
- THEN the T4.1 forge box is closed by PR 10 and no Foundry harness exists in M4's packages

#### Scenario: Chain ID to key
- GIVEN `block.chainid` 43113 and a registry with the Fuji file
- WHEN the reader resolves the key
- THEN it returns `fuji`

#### Scenario: Unknown chain ID
- GIVEN a `block.chainid` present in no registry file
- WHEN the reader resolves the key
- THEN it reverts `Registry_UnknownChainId(chainId)`

#### Scenario: Address entry
- GIVEN the Fuji entry `ccipRouter`
- WHEN the reader reads it
- THEN it returns the checksummed address from the JSON

#### Scenario: Missing entry
- GIVEN a key and entry absent from the JSON (for example an unset L1 contract)
- WHEN the reader reads it
- THEN it reverts `Registry_EntryNotFound(key, entry)` naming both

#### Scenario: Selector parse
- GIVEN `ccip.chainSelector` `"14767482510784806043"`
- WHEN the reader parses it
- THEN it returns that value as a `uint64`

#### Scenario: Bad selector
- GIVEN a selector that is non-numeric, empty, absent, or above `type(uint64).max`
- WHEN the reader parses it
- THEN it reverts `Registry_InvalidSelector(key)` (or `Registry_EntryNotFound` when absent)

#### Scenario: Read-only access
- GIVEN the project `fs_permissions`
- WHEN inspected for the registry path
- THEN it grants read only

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.1 forge `vm.parseJson` | Forge reader (modified; PR 10) |
| T4.1 only Verified facts, checksummed, tested | Unchanged (Verified, sourced, checksummed addresses; Per-chain JSON files) |
| T4.1 L1 optional | Unchanged (Optional L1 entries): the reader reverts only when an entry is requested, never on load |
