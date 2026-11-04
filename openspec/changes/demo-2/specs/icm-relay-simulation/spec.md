# ICM Relay Simulation Specification

## Purpose

A Solidity `WarpMessengerStub` standing in for the Warp precompile (absent on anvil) and a two-way TypeScript relay that moves Teleporter messages between the two local chains. Stub source lives in `packages/contracts/test/utils/`; no script deploys it. Strict TDD (Q21): Bulloak tree, red, green.

## Requirements

### Requirement: Stub identity and recording

`WarpMessengerStub` MUST return a configured blockchain ID from `getBlockchainID`, and `sendWarpMessage` MUST record the payload and return a message ID.

#### Scenario: Blockchain ID
- GIVEN a stub configured with blockchain ID X
- WHEN `getBlockchainID` is called
- THEN it returns X

#### Scenario: Send recorded
- GIVEN a payload P
- WHEN `sendWarpMessage(P)` is called
- THEN P is recorded and a message ID is returned

#### Scenario: Two sends
- GIVEN two different payloads sent in order
- WHEN the recorded payloads are read
- THEN both are present in send order with different IDs

### Requirement: Injection and verified read

The stub MUST let a caller inject a message with a source blockchain ID, origin sender, and payload, and MUST return it with `valid = true` from `getVerifiedWarpMessage(index)`. An index with no injected message MUST return `valid = false`.

#### Scenario: Injected message
- GIVEN a message injected at index 0
- WHEN `getVerifiedWarpMessage(0)` is called
- THEN it returns that message with `valid = true`

#### Scenario: Missing index
- GIVEN nothing injected at index 1
- WHEN `getVerifiedWarpMessage(1)` is called
- THEN `valid` is `false`

#### Scenario: Overwrite
- GIVEN index 0 already holds a message
- WHEN a second message is injected at index 0
- THEN the second one is returned

### Requirement: Stub is test-only

The stub source MUST live under `packages/contracts/test/utils/` with a Bulloak `.tree`, a red commit, and a green commit. No file under `script/` MUST deploy it.

#### Scenario: No script deploys it
- GIVEN `packages/contracts/script/**`
- WHEN searched for `WarpMessengerStub`
- THEN there are no matches

#### Scenario: Tree covers tests
- GIVEN the `.tree` file
- WHEN `bulloak check` runs
- THEN it passes against the test file

### Requirement: Two-way relay

The relay MUST read Teleporter `SendCrossChainMessage` events on a source chain, inject the message into the destination stub, and call `receiveCrossChainMessage` on the destination Teleporter, in both directions. It MUST relay each message once.

#### Scenario: Hub to L1
- GIVEN a message emitted on the hub
- WHEN the relay runs
- THEN the L1 Teleporter receives it with the hub blockchain ID as source

#### Scenario: L1 to hub
- GIVEN a message emitted on the L1
- WHEN the relay runs
- THEN the hub Teleporter receives it with the L1 blockchain ID as source

#### Scenario: No double delivery
- GIVEN a message already relayed
- WHEN the relay runs again
- THEN no second delivery transaction is sent

#### Scenario: Delivery reverts
- GIVEN the destination reverts on receive
- WHEN the relay runs
- THEN the failure is reported with the message ID and the relay does not mark it delivered

## Traceability

| Done-when box | Requirement |
|---|---|
| PLAN 5.3 stub returns blockchain ID, records, returns injected message | Stub identity and recording; Injection and verified read |
| PLAN 5.3 relay moves the message between Teleporters | Two-way relay |
| T8.5 ICM leg through the relay simulator | Two-way relay |
| Proposal: stub tree, red, green; no script deploys it | Stub is test-only |
