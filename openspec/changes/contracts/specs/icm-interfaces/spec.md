# ICM Interfaces Specification

## Purpose

Our own minimal MIT interfaces for the ICTT surface we call, written from the documented ABI (T7.2, Q14), pending the O7 human sign-off.

## Requirements

### Requirement: Minimal interface set

`src/interfaces/external/icm/` MUST contain exactly: `IERC20SendAndCallReceiver` (`receiveTokens(bytes32,address,address,address,uint256,bytes)`), a token transferrer interface exposing only `sendAndCall`, and the `SendAndCallInput` struct. Nothing else from `icm-services` MUST be added. Each file MUST carry `SPDX-License-Identifier: MIT` and `pragma solidity 0.8.30;`.

#### Scenario: Nothing extra
- GIVEN the directory
- WHEN its files and declarations are listed
- THEN only the three items above exist

### Requirement: Struct order and selectors pinned

`SendAndCallInput` MUST declare, in order: `destinationBlockchainID`, `destinationTokenTransferrerAddress`, `recipientContract`, `recipientPayload`, `requiredGasLimit`, `recipientGasLimit`, `multiHopFallback`, `fallbackRecipient`, `primaryFeeTokenAddress`, `primaryFee`, `secondaryFee`. A test MUST pin the literal selector of `receiveTokens` and of `sendAndCall`, and the canonical tuple type string of the struct, so any drift fails.

#### Scenario: Selector pinned
- GIVEN the pinned literal selectors in the test
- WHEN compared to `IERC20SendAndCallReceiver.receiveTokens.selector` and the transferrer `sendAndCall.selector`
- THEN both match

#### Scenario: Reordered field
- GIVEN two `SendAndCallInput` fields swapped
- WHEN the pin test runs
- THEN the tuple string comparison fails

#### Scenario: ABI-encoded call round trip
- GIVEN a `SendAndCallInput` value encoded with the interface
- WHEN decoded with the pinned tuple type string
- THEN every field equals the original

### Requirement: Provenance recorded

The upstream `ava-labs/icm-services` commit used as the ABI reference MUST be recorded next to the files. No upstream license file is copied, because no upstream source is vendored.

#### Scenario: Reference present
- GIVEN the directory
- WHEN its provenance note is read
- THEN it names the upstream repository and a commit hash, and states the files are original MIT interfaces

### Requirement: Docs reflect the decision

PLAN T7.2, standards section 4, and the O7 entry in `docs/decisions.md` MUST describe own interfaces. If O7 is refused, this capability falls back to vendoring with the Ecosystem License copied unmodified (original T7.2 boxes).

#### Scenario: Docs updated
- GIVEN the PR that adds the interfaces
- WHEN PLAN T7.2 and standards section 4 are read
- THEN neither tells the implementer to vendor upstream files

## Traceability

| Done-when box | Requirement |
|---|---|
| T7.2 License copied unmodified (replaced under O7 assumption) | Provenance recorded; Docs reflect the decision (fallback) |
| T7.2 upstream commit recorded | Provenance recorded |
| T7.2 nothing else vendored | Minimal interface set |
| Proposal risk: struct or selector drift | Struct order and selectors pinned |
