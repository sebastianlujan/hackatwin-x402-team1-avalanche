# Crosschain Protocol E2E Specification

## Purpose

T8.5 on the local pair: `pnpm test:local` and a PR CI job run the full Demo 2 path with the real deploy scripts, no secrets, RPCs, or funds. The real CCIP lane, Warp signatures, and finality are not covered (M6, T8.6).

## Requirements

### Requirement: Local test project

A Vitest `local` project and `pnpm test:local` MUST start the world, run the suite, and tear down. CI MUST run it as a PR job with no secrets.

#### Scenario: No external inputs
- GIVEN an env with no RPC URLs and no keys
- WHEN `pnpm test:local` runs
- THEN it passes

#### Scenario: Teardown
- GIVEN a finished run
- WHEN processes are listed
- THEN no anvil started by the run remains

#### Scenario: CI job
- GIVEN the CI workflow
- WHEN read
- THEN a PR job runs the `local` project and passes no secret

### Requirement: Happy path transitions

The suite MUST assert hub `None -> Pending -> Dispatched` and receiver `Received -> Settled`, with exactly one `StatusChanged` per transition and the merchant credited the full amount.

#### Scenario: Hub
- GIVEN a payment sent through the local router
- WHEN the hub logs are read
- THEN `Pending` then `Dispatched` each appear once

#### Scenario: Receiver
- GIVEN the relay delivered the ICM message
- WHEN the receiver logs are read
- THEN `Received` then `Settled` each appear once and the merchant balance rose by the amount

#### Scenario: One event per hop
- GIVEN the tracker followed the payment
- WHEN its events are counted
- THEN there is one per transition

### Requirement: Rejected path

For a merchant not on the receiver allowlist the suite MUST assert `Rejected` and that the full amount sits at `fallbackRecipient`, with no `Settled`.

#### Scenario: Not allowlisted
- GIVEN a merchant absent from the allowlist
- WHEN the payment is relayed
- THEN the receiver emits `Rejected` and no `Settled`

#### Scenario: Fallback balance
- GIVEN the same payment
- WHEN `fallbackRecipient` is read
- THEN its USDC balance rose by the full amount and the merchant's did not

### Requirement: Tracker follows end to end

The suite MUST assert the tracker emits the hops of one payment end to end and that tracking resumes from the message ID.

#### Scenario: Full track
- GIVEN the scripted payment agent runs one payment
- WHEN its hop events are read
- THEN they cover send, `Pending`, `Dispatched`, `Received`, `Settled`

#### Scenario: Resume
- GIVEN a tracker restarted with the message ID mid-flight
- WHEN the relay delivers
- THEN it emits the remaining hops only

### Requirement: Labeling and cleanliness

The suite MUST run the labeling scan of `simulated-run-labeling` over its output and events, and `git status` MUST be clean after a run.

#### Scenario: Scan in suite
- GIVEN the suite's captured output
- WHEN scanned for `sepolia`, `ccip.chain.link`, `snowtrace`, and `https://`
- THEN there are no matches

#### Scenario: Clean tree
- GIVEN a completed run
- WHEN `git status` runs
- THEN it reports no changes

## Traceability

| Done-when box | Requirement |
|---|---|
| T8.5 contracts deployed by the real deploy scripts | Local test project (via `local-crosschain-environment`) |
| T8.5 asserts `Pending -> Dispatched -> Received -> Settled` | Happy path transitions |
| T8.5 asserts `Rejected` and fallback balance | Rejected path |
| Success: `pnpm test:local` with no secrets | Local test project |
| Success: tracker resumes from a message ID | Tracker follows end to end |
| Success: simulated labeling, clean `git status` | Labeling and cleanliness |
