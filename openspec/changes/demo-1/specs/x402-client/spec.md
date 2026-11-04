# x402 Client Specification

## Purpose

Client side of `PaymentGateway`: an explicit two-request flow over `x402Client` and `x402HTTPClient` from `@x402/core`, with a guarded viem signer, emitting `AgentEvent`s.

## Requirements

### Requirement: Payment events

The client MUST emit events for 402 received, payment signed, settled, and 200, in that order.

#### Scenario: Happy path
- GIVEN a fake gateway answering 402 then 200
- WHEN `fetch` runs
- THEN the four events are emitted in order

#### Scenario: Rejected payment
- GIVEN the gateway answers 402 again after signing
- WHEN `fetch` runs
- THEN a failure event is emitted and no 200 event

### Requirement: Allowance check before signing

The client MUST read the Permit2 allowance before signing and fail with a typed error naming the shortfall if it is below the amount.

#### Scenario: Enough
- GIVEN allowance at or above the amount
- WHEN a 402 arrives
- THEN it signs

#### Scenario: Short
- GIVEN allowance below the amount
- WHEN a 402 arrives
- THEN it throws the typed error and signs nothing

### Requirement: Amount ceiling

The client MUST refuse to sign when the 402 amount exceeds the caller's `maxAmount`. It MUST NOT trust the seller's rate.

#### Scenario: Above ceiling
- GIVEN `maxAmount` 100 and a 402 asking 101
- WHEN it runs
- THEN no signature is made and `policy.decision` is emitted with `allowed: false` and reason `above_max_amount`

#### Scenario: At ceiling
- GIVEN a 402 asking exactly `maxAmount`
- WHEN it runs
- THEN it signs

### Requirement: Testable without a chain

The client MUST be unit-testable against a fake gateway.

#### Scenario: Fake
- GIVEN a fake `PaymentGateway`
- WHEN the unit suite runs
- THEN it passes with no RPC

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.5 events cover 402, signed, settled, 200 | Payment events |
| T5.5 allowance checked before signing | Allowance check before signing |
| T5.5 unit tests on fake gateway | Testable without a chain |
| Proposal: refuses above `maxAmount` | Amount ceiling |
