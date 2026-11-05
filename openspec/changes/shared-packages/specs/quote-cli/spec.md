# Quote CLI Specification

## Purpose

`pnpm quote` is a composition root printing the live USD to ARGt rate from the shared guarded oracle.

## Requirements

### Requirement: Normal line

When Curve is used, the output MUST be exactly `1 USD = <x> ARGt (Curve, block N) | Chainlink <y> | Δ <z>% ✓`.

#### Scenario: Within band
- GIVEN Curve 1658.3 at block N, Chainlink 1657.9
- WHEN `pnpm quote` runs
- THEN it prints `1 USD = 1658.3 ARGt (Curve, block N) | Chainlink 1657.9 | Δ 0.02% ✓`

### Requirement: Guarded line

When guarded, the output MUST be `1 USD = <y> ARGt (Chainlink, guarded) | Curve <x> (block N) | Δ <z>% ⚠`.

#### Scenario: Outside band
- GIVEN Curve 1700 and Chainlink 1657.9 (Δ above 2%)
- WHEN it runs
- THEN it prints the guarded line with Chainlink as the rate (unit-tested with fakes)

### Requirement: No duplicated logic

The script MUST only wire the `chains` and `pricing` adapters and format output; band and freeze logic MUST NOT be reimplemented.

#### Scenario: Reuse
- GIVEN the script source
- WHEN inspected by test
- THEN it imports `GuardedOracle` and contains no band arithmetic

#### Scenario: Failure
- GIVEN an oracle error (stale, sequencer down)
- WHEN it runs
- THEN it prints the error and exits non-zero

### Requirement: Runbook updated

demos.md MUST document `pnpm quote` and the guarded line; Q12 and demos.md MUST say `maxTimeoutSeconds` for the freeze window.

#### Scenario: Docs
- GIVEN the merged change
- WHEN docs are read
- THEN the runbook shows both lines and no script-to-be-added note

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.7 output matches documented line, guard flag | Normal line; Guarded line |
| T4.7 reuses adapters, no duplication | No duplicated logic |
| T4.7 runbook updated | Runbook updated |
