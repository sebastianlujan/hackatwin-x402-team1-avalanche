# Chain Client Specification

## Purpose

A viem adapter implementing the `ChainClient` port with read-only mainnet chains and a guard for chain ID 43114.

## Requirements

### Requirement: Adapter implements the port

The adapter MUST implement `ChainClient`, including block-pinned reads, over viem pinned to an exact version.

#### Scenario: Pinned read
- GIVEN an adapter on Arbitrum
- WHEN `readContract` is called with `blockNumber` N
- THEN the RPC call is made at block N and the result carries N

### Requirement: Read-only mainnets

Clients for Arbitrum and Base MUST refuse every write.

#### Scenario: Write on Base
- GIVEN a Base client
- WHEN a write or send is attempted
- THEN it throws a read-only error and no RPC write method is called

### Requirement: 43114 anvil guard

Writes on chain ID 43114 MUST be refused unless the RPC is loopback AND `web3_clientVersion` reports anvil, checked at startup.

#### Scenario: Public RPC
- GIVEN chain 43114 with `https://api.avax.network/ext/bc/C/rpc`
- WHEN the client starts and a write is attempted
- THEN the write is refused

#### Scenario: Loopback not anvil
- GIVEN a loopback RPC whose `web3_clientVersion` lacks "anvil"
- WHEN a write is attempted
- THEN it is refused

#### Scenario: Local anvil
- GIVEN a loopback RPC reporting anvil
- WHEN a write is attempted
- THEN it is allowed

### Requirement: Keystores decrypted in roots only

Web3 Secret Storage decryption MUST be callable only from composition roots; library packages MUST NOT import it.

#### Scenario: Public test vector
- GIVEN the public Web3 Secret Storage test vector and its password
- WHEN a root decrypts it
- THEN the expected key is recovered; a wrong password throws without echoing the password

#### Scenario: Import boundary
- GIVEN the dependency-rule check
- WHEN a non-root package imports the decrypt function
- THEN the check fails

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.2 writes on 43114 refused unless local anvil | 43114 anvil guard; Read-only mainnets |
| T4.2 keystores only in roots | Keystores decrypted in roots only |
| T4.2 unit tests cover the guard | 43114 anvil guard (all three scenarios) |
