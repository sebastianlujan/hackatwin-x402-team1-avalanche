# Core Domain and Ports Specification

## Purpose

Domain types, the seven ports, and test-only fakes in `@hackatwin/core`.

## Requirements

### Requirement: Domain types

Core MUST export `Money` (bigint units plus decimals), `Quote`, `PaymentIntent`, and a discriminated `AgentEvent` union. `PaymentIntent` statuses MUST reuse the contract state names (`None`, `Pending`, `Dispatched`, `Received`, `Settled`, `Rejected`, `Refunded`).

#### Scenario: Money arithmetic

- GIVEN two `Money` values with the same decimals
- WHEN added
- THEN the result is exact bigint units with no rounding

#### Scenario: Mismatched decimals

- GIVEN two `Money` values with different decimals
- WHEN added
- THEN an error is thrown

### Requirement: AgentEvent wire format

Every `AgentEvent` MUST carry a `version` field. In JSON, amounts MUST be base-unit decimal strings, never numbers. Serializing then parsing an event MUST round-trip equal.

#### Scenario: Round trip

- GIVEN an event with an amount above 2^53
- WHEN it is serialized and parsed
- THEN the amount is identical and serialized as a string

#### Scenario: Unknown version

- GIVEN JSON with an unsupported `version`
- WHEN parsed
- THEN parsing fails with a readable error

### Requirement: Seven ports

Core MUST export interfaces `PaymentGateway`, `AgentIdentity`, `AgentPolicy`, `ChainClient`, `LLM`, `PriceOracle`, and `CrossChainMessenger`, with tokens for each.

#### Scenario: Compile check

- GIVEN a class implementing each port
- WHEN the project typechecks
- THEN it compiles

### Requirement: Zero runtime dependencies and no adapters

Core MUST compile with no runtime dependency and MUST contain no adapter code (no I/O, viem, x402, or SDK imports).

#### Scenario: Import scan

- GIVEN the core source
- WHEN scanned for non-relative imports
- THEN none are runtime packages

### Requirement: Test-only fakes

`@hackatwin/core/testing` MUST provide one in-memory fake per port, deterministic and scriptable. Non-test code MUST NOT import it (enforced by the dependency-rule test).

#### Scenario: Scripted fake

- GIVEN a fake `LLM` scripted with two replies
- WHEN called twice
- THEN it returns them in order

#### Scenario: Fake in production code

- GIVEN a non-test file imports `@hackatwin/core/testing`
- WHEN the dependency-rule test runs
- THEN it fails

## Traceability

| Done-when | Requirement |
|---|---|
| T3.3 ports compile with no runtime dependency | Seven ports; Zero runtime dependencies |
| T3.3 each port has a test-only fake | Test-only fakes |
| T3.3 no adapter code in core | Zero runtime dependencies and no adapters |
| Proposal: version field, string amounts | AgentEvent wire format |
