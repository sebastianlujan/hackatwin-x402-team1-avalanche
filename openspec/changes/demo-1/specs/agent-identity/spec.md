# Agent Identity Specification

## Purpose

`AgentIdentity` adapter over the official ERC-8004 registries (C3).

## Requirements

### Requirement: Register returns agentId

`register(agentURI)` MUST call the Identity registry and return the `agentId` decoded from the `Registered` event.

#### Scenario: Register
- GIVEN the registry on the fork
- WHEN `register('ipfs://x')` is called
- THEN the returned `agentId` equals the `Registered` event's `agentId`

#### Scenario: No event
- GIVEN a receipt without `Registered`
- WHEN decoding runs
- THEN a typed error is thrown

### Requirement: Verified feedback

`giveFeedback` MUST use the verified registry function and signature. A feedback from an identity owner to its own `agentId` MUST fail with a typed self-feedback error before or on submission.

#### Scenario: Feedback
- GIVEN buyer and seller with distinct keys and identities
- WHEN the buyer gives a positive score to the seller's `agentId`
- THEN the transaction succeeds and an event names the seller's `agentId`

#### Scenario: Self feedback
- GIVEN an agent rating its own `agentId`
- WHEN `giveFeedback` runs
- THEN it throws the typed self-feedback error

### Requirement: Read reputation

The adapter MUST read an `agentId`'s reputation summary.

#### Scenario: After feedback
- GIVEN one positive feedback was given
- WHEN reputation is read
- THEN the count is 1

### Requirement: Registration script

A script MUST register the buyer and the seller on the fork with separate keys and print both `agentId`s. A rerun MUST NOT register a role twice.

#### Scenario: Both registered
- GIVEN a funded fork
- WHEN the script runs
- THEN two distinct `agentId`s are printed

#### Scenario: Rerun
- GIVEN both roles registered
- WHEN it runs again
- THEN the same ids are printed and no transaction is sent

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.2 `register` returns `agentId` | Register returns agentId |
| T5.2 verified signature, typed self-feedback error | Verified feedback |
| T5.2 script registers buyer and seller | Registration script |
