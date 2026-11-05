# Registry Verification Specification

## Purpose

`pnpm chains:verify` checks every registry address on-chain, read-only, for the nightly job.

## Requirements

### Requirement: Step 0 checks repeated

The command MUST read code size and key views at every registry address, repeating the Step 0 checks of PLAN.md, using read-only RPCs and no secrets.

#### Scenario: All healthy
- GIVEN every address has code and views return expected values
- WHEN `pnpm chains:verify` runs
- THEN it prints one pass line per entry and exits 0

#### Scenario: Optional L1 skipped
- GIVEN L1 entries are absent
- WHEN it runs
- THEN they are reported as skipped, not failed

### Requirement: Failures name chain and address

A missing contract or wrong view value MUST fail with the chain name and address.

#### Scenario: Missing contract
- GIVEN an address with code size 0 on Base
- WHEN it runs
- THEN output names "base" and that address and the run fails

### Requirement: Non-zero exit

Any failure, including an unreachable RPC, MUST yield a non-zero exit after all entries are checked.

#### Scenario: One of many fails
- GIVEN one failing entry among passing ones
- WHEN it runs
- THEN all entries are reported and the exit code is non-zero

#### Scenario: RPC down
- GIVEN an unreachable RPC
- WHEN it runs
- THEN affected entries fail naming chain and address, exit non-zero

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.3 repeats Step 0 checks | Step 0 checks repeated |
| T4.3 missing contract fails with chain and address | Failures name chain and address |
| T4.3 non-zero exit | Non-zero exit |
