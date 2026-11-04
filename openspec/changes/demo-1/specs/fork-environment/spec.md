# Fork Environment Specification

## Purpose

Local C-Chain anvil fork scripts for Demo 1: pinned start, throwaway keystores, funding.

## Requirements

### Requirement: Pinned fork start

`pnpm demo1:fork` MUST start anvil with `--chain-id 43114 --hardfork cancun` at block `N`, an executed block behind the head. `N` MUST be recorded as `forkBlock` in the `cchain-fork` profile. A rerun with a healthy fork at `N` MUST be a no-op.

#### Scenario: Start at N
- GIVEN no fork is running and `forkBlock` is set
- WHEN `pnpm demo1:fork` runs
- THEN anvil serves chain 43114 on loopback with `eth_blockNumber` at least `N`

#### Scenario: Rerun
- GIVEN a healthy fork at `N`
- WHEN the script runs again
- THEN it exits 0 and starts no second anvil

#### Scenario: N not served
- GIVEN the upstream RPC cannot serve `N`
- WHEN the script runs
- THEN it exits non-zero naming `N`

### Requirement: Throwaway role keystores

If absent, the fork script MUST create one keystore per role (agent, seller, facilitator) and a 0600 password file each, inside gitignored `.demo1/`. Existing keystores, and keystores named by env, MUST be kept. No raw key MUST be printed or stored in plaintext.

#### Scenario: First run
- GIVEN an empty `.demo1/`
- WHEN the script runs
- THEN three keystores and three 0600 password files exist

#### Scenario: Existing keystore
- GIVEN an agent keystore from an earlier run
- WHEN the script runs
- THEN its address is unchanged

#### Scenario: Env wins
- GIVEN env names a keystore for the agent
- WHEN the script runs
- THEN no agent keystore is generated

### Requirement: Idempotent funding

`pnpm demo1:fund` MUST give gas to every role that sends a transaction: the agent, the seller, the facilitator, and Twin's LayerZero adapter (which pays the mint). The ARGt target T MUST be 2x the total budget, quoted once and recorded for the fork block. The script MUST top up to T: mint only the agent's shortfall below T by impersonating the adapter, and `approve(Permit2, T)` only when the allowance is below T. The approval MUST NOT be `maxUint256`. After funding, the balance MUST be at least T and the allowance MUST equal T. A rerun with both already met MUST NOT mint or approve.

#### Scenario: Fund
- GIVEN a fresh fork and total budget B
- WHEN `pnpm demo1:fund` runs
- THEN the agent holds 2B ARGt, the Permit2 allowance equals 2B, and the agent, seller, facilitator, and adapter hold gas

#### Scenario: Rerun
- GIVEN the agent is already funded
- WHEN it runs again
- THEN no transaction is sent and balance and allowance are unchanged

#### Scenario: Top up after a payment
- GIVEN a payment of p ARGt since the last funding
- WHEN `pnpm demo1:fund` runs
- THEN it mints exactly p and approves T, and the recorded T is reused

### Requirement: Funding assertions

The funding script MUST assert balance >= T and allowance == T and exit non-zero naming the failed value. It MUST write only through guarded loopback anvil clients.

#### Scenario: Allowance mismatch
- GIVEN the allowance reads below the expected amount
- WHEN assertions run
- THEN the script exits non-zero naming the allowance

#### Scenario: Non-anvil RPC
- GIVEN the RPC is a public C-Chain endpoint
- WHEN the script starts
- THEN it refuses before any write

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.1 `N` executed, recorded in `cchain-fork` | Pinned fork start |
| T5.1 fork and fund idempotent | Pinned fork start; Idempotent funding |
| T5.1 asserts balance and allowance | Funding assertions |
| T5.2 script registers buyer and seller | agent-identity: Registration script |
| Q20 fresh keys | Throwaway role keystores |
