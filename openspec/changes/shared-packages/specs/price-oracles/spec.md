# Price Oracles Specification

## Purpose

`PriceOracle` adapters for ARGt per USD: Curve (primary), Chainlink (guard), and a guarded decorator with a frozen quote. Depends only on the `ChainClient` port.

## Requirements

### Requirement: Curve pool oracle

`CurvePoolOracle` MUST read `price_oracle()` at one block, return ARGt per USD plus that block number, treat USD₮0 as 1 USD, and assert `coins(0)` is ARGt and `coins(1)` is USD₮0.

#### Scenario: Happy read
- GIVEN a fake client with `price_oracle()` = 1658.36e18 at block N and correct coins
- WHEN the oracle quotes
- THEN it returns 1658.36 ARGt per USD at block N

#### Scenario: Wrong coins
- GIVEN `coins(0)` is not ARGt, or `coins(1)` is not USD₮0
- WHEN the oracle quotes
- THEN it throws naming the unexpected coin

### Requirement: Chainlink feed oracle

`ChainlinkFeedOracle` MUST read the Base ARS/USD proxy, read `decimals()` at runtime, reject rounds older than 24 h, check the sequencer uptime feed (`AggregatorV2V3Interface`), and invert USD per ARS into ARS per USD. It MUST NOT use `answeredInRound`.

#### Scenario: Fresh round
- GIVEN decimals 8, answer 60317, updated 1 h ago, sequencer up
- WHEN it quotes
- THEN it returns the inverted rate (about 1657.9)

#### Scenario: Stale round
- GIVEN `updatedAt` older than 24 h
- WHEN it quotes
- THEN it throws a stale-round error

#### Scenario: Sequencer down
- GIVEN the sequencer answer is 1 (down)
- WHEN it quotes
- THEN it throws a sequencer-down error

#### Scenario: Grace period
- GIVEN the sequencer is up but `startedAt` is under 3600 s ago
- WHEN it quotes
- THEN it throws a grace-period error; at exactly 3600 s it succeeds

#### Scenario: Sequencer unreadable
- GIVEN the sequencer round has `startedAt == 0`
- WHEN it quotes
- THEN it is rejected

#### Scenario: Zero or negative answer
- GIVEN the price answer is 0 or negative
- WHEN it quotes
- THEN it throws

### Requirement: Guarded oracle

`GuardedOracle` MUST use Curve when `|curve - chainlink| / chainlink <= 200 bps` (inclusive, integer math); otherwise Chainlink with `guarded: true`.

#### Scenario: Exactly +2%
- GIVEN Curve is exactly 2% above Chainlink
- WHEN it quotes
- THEN Curve is used, `guarded` false

#### Scenario: Exactly -2%
- GIVEN Curve is exactly 2% below
- WHEN it quotes
- THEN Curve is used

#### Scenario: Just outside
- GIVEN Curve is 1 unit beyond 2% on either side
- WHEN it quotes
- THEN Chainlink is returned with `guarded: true`

### Requirement: Frozen quote

The guarded oracle MUST reuse one rate per asset for 30 s, then re-read.

#### Scenario: Within window
- GIVEN a quote at t=0
- WHEN asked again at t=29 s
- THEN the same rate is returned and no RPC read occurs

#### Scenario: Expired
- GIVEN a quote at t=0
- WHEN asked at t=30 s
- THEN fresh readings are taken

### Requirement: Nightly integration

Curve and Chainlink real-RPC tests MUST run only in a nightly Vitest project, never in PR CI.

#### Scenario: PR CI
- GIVEN the default test run
- WHEN it executes
- THEN no real RPC is called

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.4 asserts coins | Curve pool oracle |
| T4.4 unit tests with fake client; nightly Arbitrum | Curve pool oracle; Nightly integration |
| T4.5 runtime decimals, 24 h staleness | Chainlink feed oracle |
| T4.5 sequencer up, 3600 s grace | Chainlink feed oracle |
| T4.5 stale and sequencer-down tests | Chainlink feed oracle |
| T4.6 within 2% Curve else Chainlink flagged | Guarded oracle |
| T4.6 frozen quote reused | Frozen quote |
| T4.6 exactly 2% both sides | Guarded oracle |
