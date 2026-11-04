# x402 Facilitator Specification

## Purpose

Self-hosted Hono facilitator running `x402Facilitator` (Q11).

## Requirements

### Requirement: Supported schemes

`GET /supported` MUST list `eip155:43114` with the `exact` scheme.

#### Scenario: Supported
- GIVEN the facilitator is running on the fork profile
- WHEN `/supported` is fetched
- THEN `eip155:43114` with `exact` is listed

#### Scenario: Unconfigured network
- GIVEN a payment for `eip155:1`
- WHEN verify is called
- THEN it is rejected as unsupported

### Requirement: Constants match registry

The installed `@x402/evm` Permit2 and proxy addresses MUST equal the registry; a mismatch MUST fail startup naming the constant.

#### Scenario: Match
- GIVEN the pinned `@x402/evm`
- WHEN the check runs
- THEN both addresses equal the registry

#### Scenario: Drift
- GIVEN a registry proxy address different from the SDK's
- WHEN the service starts
- THEN it exits non-zero naming the proxy

### Requirement: Keystore signer

The facilitator MUST sign with the facilitator keystore through a guarded client only.

#### Scenario: Public RPC
- GIVEN a non-anvil RPC
- WHEN the service starts
- THEN it refuses to settle

### Requirement: Fork settlement

The facilitator MUST verify and settle an exact Permit2 payment through the canonical proxy on the fork.

#### Scenario: Settle
- GIVEN a funded agent with allowance and a signed Permit2 payment
- WHEN verify then settle run
- THEN the payee's ARGt balance rises by the amount and a transaction hash is returned

#### Scenario: Expired
- GIVEN a payment past its deadline
- WHEN verify runs
- THEN it is invalid and nothing settles

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.3 `/supported` lists `eip155:43114` | Supported schemes |
| T5.3 constants match registry | Constants match registry |
| T5.3 integration settles on the fork | Fork settlement; Keystore signer |
