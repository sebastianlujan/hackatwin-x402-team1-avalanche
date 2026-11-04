# Contracts Toolchain Specification

## Purpose

The Foundry project in `packages/contracts`: compiler settings, pinned dependencies, CI gates, TDD enforcement, and ABI export for viem (T7.1, Q21).

## Requirements

### Requirement: Compiler and formatting settings

`foundry.toml` MUST set `solc_version = '0.8.30'` and `evm_version = 'cancun'` explicitly, and `[fmt]` MUST use line length 120, tab width 2, single quotes, and sorted imports. Every source file MUST use `pragma solidity 0.8.30;`. The file MUST NOT embed RPC secrets or keys; endpoints come from environment references.

#### Scenario: Cancun is explicit
- GIVEN a clean checkout
- WHEN `forge config --json` is read
- THEN `evm_version` is `cancun` and `solc_version` is `0.8.30`

#### Scenario: Secrets absent
- GIVEN `foundry.toml` and all files under `packages/contracts`
- WHEN scanned for key material or RPC URLs with credentials
- THEN none are found; endpoints appear only as `${ENV_NAME}` references

### Requirement: Pinned dependencies through pnpm only

Dependencies MUST be exact pins (no `^` or `~`) installed by pnpm: OZ `5.7.0`, aliased OZ `5.3.0` and `4.8.3`, `@chainlink/contracts-ccip@2.0.0`, `@chainlink/contracts@1.5.0`, `@chainlink/local@0.3.1`, and one `forge-std` tag. The project MUST NOT use git submodules or `forge install`. Versioned remappings MUST resolve each alias to its own package.

#### Scenario: Probe proves remappings
- GIVEN a test-only probe that imports one symbol from every dependency and alias
- WHEN `forge build` runs
- THEN it succeeds, so every remapping resolves

#### Scenario: No submodules
- GIVEN the repository
- WHEN checked for `.gitmodules` and `lib/` git entries under `packages/contracts`
- THEN neither exists

#### Scenario: Floating version rejected
- GIVEN `packages/contracts/package.json`
- WHEN a dependency range is not an exact version
- THEN the dependency-pin check fails

### Requirement: CI gates

A `contracts` CI job MUST run `forge fmt --check`, `forge build`, `forge test`, `bulloak check`, lintspec, and solhint (`solhint-config-wonderland`), and `ci-gate` MUST require it. Hooks, commitlint, and workflows MUST stay at the repo root: the package MUST NOT add `.husky/`, `commitlint.config.js`, `.github/`, or a `deploy:mainnet` script.

#### Scenario: Gate requires the job
- GIVEN a PR that changes `packages/contracts/**`
- WHEN any contracts step fails
- THEN `ci-gate` fails

#### Scenario: Untouched package
- GIVEN a PR that does not change `packages/contracts/**`
- WHEN CI runs
- THEN `ci-gate` still passes under the same skip rule as the other path-filtered jobs

#### Scenario: Root-only tooling
- GIVEN `packages/contracts`
- WHEN listed
- THEN it holds no `.husky/`, `commitlint.config.js`, `.github/`, or `deploy:mainnet` entry

### Requirement: Strict TDD and tree sync

Every contract MUST have one Bulloak `.tree` per transition or behavior, scaffolded into tests prefixed `Unit*` or `Integration*`. `bulloak check` MUST fail when a tree and its test drift. Each contract PR MUST show, in its commit list, the tree commit, then a failing-test commit (red), then the implementation commit (green) (Q21).

#### Scenario: Drift detected
- GIVEN a `.tree` branch with no matching test function
- WHEN `bulloak check` runs
- THEN it fails and CI is red

#### Scenario: Red before green
- GIVEN a contract PR
- WHEN its commits are listed oldest first
- THEN the tree commit precedes the test commit, which precedes the implementation commit, and the test commit fails `forge test`

### Requirement: Test profiles

The default profile MUST run fuzz and invariant suites at CI depth. A `deep` profile MUST raise fuzz runs and invariant runs and depth, and MUST be runnable with `FOUNDRY_PROFILE=deep` for the nightly run.

#### Scenario: Deep profile
- GIVEN the `deep` profile
- WHEN `forge config` is printed with it
- THEN fuzz runs and invariant runs and depth exceed the default profile values

### Requirement: ABI export for viem

An export step MUST write each contract and interface ABI as an `as const` TypeScript module under `packages/contracts/abi`, keyed by fully qualified artifact name so repeated artifact names across OZ versions cannot collide. A drift check MUST fail when committed ABIs differ from a fresh export. Generated ABIs do not count toward the PR line budget.

#### Scenario: Typed ABI
- GIVEN an exported module
- WHEN imported with viem `getContract`
- THEN function names and argument types infer without casts

#### Scenario: Drift check
- GIVEN a changed external signature with no re-export
- WHEN the drift check runs
- THEN it fails

### Requirement: PR size

Each PR MUST stay within 400 authored lines (lockfile and generated ABIs excluded) with no `size:exception`.

#### Scenario: Budget respected
- GIVEN any PR in the chain
- WHEN additions plus deletions are counted without the lockfile and generated ABIs
- THEN the total is at most 400

## Traceability

| Done-when box | Requirement |
|---|---|
| T7.1 `cancun`, one `forge-std` tag, remappings proven by `forge build` | Compiler and formatting settings; Pinned dependencies through pnpm only |
| T7.1 CI runs fmt check, build, test, lintspec, Bulloak | CI gates; Strict TDD and tree sync |
| T7.1 ABIs export as `as const` for viem | ABI export for viem |
| Proposal: CI gate, TDD order, 400 lines | CI gates; Strict TDD and tree sync; PR size |
| M7 tests: deep fuzz nightly | Test profiles |
