# Crosschain Messaging Local Specification

## Purpose

The local `CrossChainMessenger` adapter (local variant of T8.1). Status via the CCIP API and the real sender stay out (M6, T7.12). O5 stays open: the adapter sends from the agent EOA with extraArgs encoded off-chain, behind the port.

## Requirements

### Requirement: Check lane, quote, then send

`send` MUST call `isChainSupported`, then `getFee`, then `ccipSend` on the local router with extraArgs V3 (C2), in that order, and return the CCIP message ID.

#### Scenario: Happy path
- GIVEN a supported lane
- WHEN `send` runs
- THEN the calls happen in order `isChainSupported`, `getFee`, `ccipSend` and the message ID is returned

#### Scenario: Fee paid
- GIVEN a quoted native fee F
- WHEN `ccipSend` is called
- THEN the value sent equals F

### Requirement: Unsupported lane stops before sending

An unsupported destination MUST fail with an error naming the selector, with no `getFee` and no `ccipSend` call.

#### Scenario: Unsupported
- GIVEN `isChainSupported` returns false
- WHEN `send` runs
- THEN it throws naming the selector and nothing else is called

### Requirement: Port-only, fake-testable

The adapter MUST implement the `CrossChainMessenger` port, take a `ChainClient`, and be unit-tested with a fake `ChainClient`. It MUST NOT encode a sender contract assumption (O5).

#### Scenario: Fake client
- GIVEN a `FakeChainClient` scripted for the three calls
- WHEN `send` runs
- THEN the unit test passes with no network

#### Scenario: Unscripted call
- GIVEN the fake has no script for `getFee`
- WHEN `send` runs
- THEN the fake throws naming address, function, and args

### Requirement: Local transport

The adapter MUST report transport `local` and MUST NOT call the CCIP API.

#### Scenario: Transport
- GIVEN a completed send
- WHEN the result is read
- THEN transport is `local` and no HTTP request was made

## Traceability

| Done-when box | Requirement |
|---|---|
| T8.1 checks lane support and quotes fee before sending | Check lane, quote, then send; Unsupported lane stops before sending |
| T8.1 unit tests use a fake `ChainClient` | Port-only, fake-testable |
| T8.1 status from CCIP API (not in this change) | Local transport (deferred to M6) |
