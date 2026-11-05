# Local Crosschain Profile Specification

## Purpose

The `local-crosschain` profile, its loopback-only RPC keys, a write guard, and local chain definitions. Config keys and the profile union live in `config-profiles` (modified delta); this capability covers the local chains and the guard behavior.

## Requirements

### Requirement: Local chain definitions

`packages/chains` MUST export local hub and local L1 chain definitions with plain-anvil mode, no explorer, and no registry membership. The six-chain registry MUST stay unchanged.

#### Scenario: No explorer
- GIVEN the local hub chain definition
- WHEN its explorer is read
- THEN none is defined

#### Scenario: Registry unchanged
- GIVEN the real registry reader
- WHEN all chains are loaded
- THEN exactly the six base chains are returned

#### Scenario: Plain mode
- GIVEN the anvil helper in plain mode
- WHEN it starts a chain
- THEN no fork URL is passed

### Requirement: Local clients are write-guarded

Local chains MUST be treated like a fork by `createGuardedClients` (ADR 0007): writes are allowed only when the RPC is loopback and the chain ID equals the `local-crosschain` profile's validated static chain ID (a statics-schema value, not an env key).

#### Scenario: Loopback write
- GIVEN a loopback RPC with the configured local chain ID
- WHEN a write is requested
- THEN the guard allows it

#### Scenario: Wrong chain ID
- GIVEN a loopback RPC that reports 43113
- WHEN a write is requested
- THEN the guard refuses and no transaction is sent

#### Scenario: Remote host
- GIVEN a non-loopback RPC
- WHEN guarded clients are created
- THEN creation fails naming the URL host

### Requirement: Transaction URLs absent for local chains

The explorer helper `txUrl` MUST return `undefined` for local chains.

#### Scenario: Local hash
- GIVEN a local chain key and a valid hash
- WHEN the helper runs
- THEN it returns `undefined`

## Traceability

| Done-when box | Requirement |
|---|---|
| Proposal S3 loopback and anvil guard | Local clients are write-guarded |
| Success: no live explorer link | Transaction URLs absent for local chains |
| Success: no secrets, RPCs, or funds | Local chain definitions |
