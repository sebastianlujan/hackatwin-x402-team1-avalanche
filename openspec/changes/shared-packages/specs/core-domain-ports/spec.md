# Delta for Core Domain Ports (core-di)

Base: `openspec/changes/core-di/specs/core-domain-ports/spec.md`.

## ADDED Requirements

### Requirement: Block-pinned ChainClient reads

`ChainClient` read calls MUST accept an optional `blockNumber`. Every read result MUST report the block number it was read at, so a caller can pair several reads at one block.

#### Scenario: Pinned read
- GIVEN a `ChainClient` read with `blockNumber` N
- WHEN it resolves
- THEN the result reports block N

#### Scenario: Unpinned read
- GIVEN a read with no `blockNumber`
- WHEN it resolves
- THEN the result reports the block actually read

## MODIFIED Requirements

### Requirement: Seven ports

Core MUST export interfaces `PaymentGateway`, `AgentIdentity`, `AgentPolicy`, `ChainClient`, `LLM`, `PriceOracle`, and `CrossChainMessenger`, with tokens for each. `ChainClient` MUST support block-pinned reads (see Block-pinned ChainClient reads).
(Previously: `ChainClient` had no block-pinning contract.)

#### Scenario: Compile check

- GIVEN a class implementing each port
- WHEN the project typechecks
- THEN it compiles

#### Scenario: Pinned read in the port
- GIVEN a class implementing `ChainClient` without a `blockNumber` option or a block in its read result
- WHEN the project typechecks
- THEN it fails

### Requirement: Test-only fakes

`@hackatwin/core/testing` MUST provide one in-memory fake per port, deterministic and scriptable. Non-test code MUST NOT import it (enforced by the dependency-rule test). `FakeChainClient` MUST be arg-aware: scripted reads are matched by address, function, and args, and it MUST record the requested `blockNumber`. An unscripted call MUST throw an error naming address, function, and args.
(Previously: fakes only had to be scriptable; no arg matching for `ChainClient`.)

#### Scenario: Scripted fake

- GIVEN a fake `LLM` scripted with two replies
- WHEN called twice
- THEN it returns them in order

#### Scenario: Fake in production code

- GIVEN a non-test file imports `@hackatwin/core/testing`
- WHEN the dependency-rule test runs
- THEN it fails

#### Scenario: Same function, different args
- GIVEN `FakeChainClient` scripted with `coins(0)` returning ARGt and `coins(1)` returning USD₮0
- WHEN each is read
- THEN each returns its own value

#### Scenario: Unscripted call
- GIVEN no script for `price_oracle()`
- WHEN it is read
- THEN the fake throws naming address, function, and args

#### Scenario: Requested block recorded
- GIVEN a read pinned at block N
- WHEN the test inspects the fake
- THEN block N is recorded for that call

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.4 unit tests use a fake `ChainClient` | Test-only fakes (arg-aware) |
| T4.4 Curve reads at one block, returns block number | Block-pinned ChainClient reads; Seven ports |
| T4.6/T4.7 line prints block N | Block-pinned ChainClient reads |
