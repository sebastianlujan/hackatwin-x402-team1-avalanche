# Chain Registry Specification

## Purpose

One address source for every package: per-chain JSON with a source per address, a typed TS reader, and viem chain objects.

## Requirements

### Requirement: Per-chain JSON files

The registry MUST hold one JSON file each for the C-Chain fork (43114), Fuji, Sepolia, TwinPay L1, Arbitrum (read-only), and Base (read-only).

#### Scenario: Six chains load
- GIVEN the registry package
- WHEN the typed reader loads all chains
- THEN exactly six chains are returned; the five live ones each have a chain ID and a viem chain object, and the planned `twinpay-l1` has neither until T6.1 (SD1)

#### Scenario: Unknown chain
- GIVEN a chain key not in the registry
- WHEN the reader is asked for it
- THEN it throws an error naming the key

### Requirement: Verified, sourced, checksummed addresses

Every address MUST appear in decisions.md Verified facts (or be promoted there first with a source), MUST carry a non-empty `source`, and MUST be EIP-55 checksummed.

#### Scenario: Checksum enforced
- GIVEN every address in every registry file
- WHEN the registry test runs
- THEN each address equals its `getAddress()` form and has a source URL or read reference

#### Scenario: Unverified address rejected
- GIVEN an entry whose address is not in Verified facts
- WHEN the registry test runs
- THEN the test fails naming chain and entry

#### Scenario: Promoted entries
- GIVEN Arbitrum ARGt `0x59863989d080B22476DB95656d0C3CC18be92214`, USD₮0 `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`, the Base sequencer feed, and Fuji TeleporterRegistry
- WHEN promoted
- THEN each is first added to Verified facts with its source (coins(0), coins(1) reads on Arbitrum; official Chainlink page; Avalanche docs), then to its JSON file

### Requirement: Optional L1 entries

TwinPay L1 entries MUST be optional until deployed; absence MUST NOT fail loading or tests.

#### Scenario: L1 not deployed
- GIVEN the L1 file has no deployed contract addresses
- WHEN the reader loads it
- THEN loading succeeds and L1 lookups return `undefined`

### Requirement: Forge reader (deferred)

A forge script reading the JSON with `vm.parseJson` SHALL be delivered after T7.1; M4 MUST NOT add a Foundry harness.

#### Scenario: Deferred box
- GIVEN T7.1 is not merged
- WHEN M4 completes
- THEN the forge box remains open and tracked by PR 10

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.1 only Verified facts, checksummed, tested | Verified, sourced, checksummed addresses; Per-chain JSON files |
| T4.1 forge `vm.parseJson` | Forge reader (deferred, PR 10) |
| T4.1 L1 optional | Optional L1 entries |
