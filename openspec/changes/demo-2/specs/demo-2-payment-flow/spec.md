# Demo 2 Payment Flow Specification

## Purpose

T8.3 and T8.4: treasury setup, and the payment agent with `registerCrossChainModule`, run on the local pair through the shared runner (ADR 0008) with a scripted plan in E2E.

## Requirements

### Requirement: Idempotent treasury setup

The setup MUST create the lane, approve the hub from the treasury, and sign the EIP-712 budget authorization for the broker. Re-running it MUST NOT create a second lane, re-send an approval already in place, or change the budget.

#### Scenario: First run
- GIVEN a fresh local world
- WHEN the setup runs
- THEN a lane exists, the approval is set, and the budget is signed

#### Scenario: Second run
- GIVEN the setup already ran
- WHEN it runs again
- THEN no transaction is sent and the lane `Id` is unchanged

### Requirement: Budget from the profile

The budget MUST come from the `local-crosschain` profile, never from a literal in the script.

#### Scenario: Profile budget
- GIVEN a profile with budget B
- WHEN the setup runs
- THEN the signed authorization carries B

#### Scenario: Missing budget
- GIVEN a profile without a budget
- WHEN the setup runs
- THEN it fails naming the field before any transaction

### Requirement: Setup output

The setup MUST print the lane `Id` and the remaining budget. A local run's first line MUST be `SIMULATED (local-crosschain)`.

#### Scenario: Output
- GIVEN a completed setup
- WHEN stdout is read
- THEN it shows line 1 `SIMULATED (local-crosschain)`, the lane `Id`, and the remaining budget

### Requirement: Payment agent triggers and tracks

The agent root MUST run on the shared runner with tools that trigger one payment through the messenger and track it through the hop tracker until a terminal status. With the scripted LLM in E2E it MUST need no API key.

#### Scenario: One payment
- GIVEN the scripted plan and a funded treasury
- WHEN the agent runs
- THEN exactly one payment is sent and hops are emitted through `Settled`

#### Scenario: No key
- GIVEN no `ANTHROPIC_API_KEY`
- WHEN the agent runs with the scripted LLM
- THEN it runs to completion

#### Scenario: Run events
- GIVEN a local run
- WHEN events are read
- THEN `run.started` names `scripted` and every event carries `simulated: 'local-crosschain'`

### Requirement: Cross-chain module

`registerCrossChainModule(container, config)` MUST only register tokens and never resolve them, and MUST also expose ICTT funding of an L1 address for Demo 3.

#### Scenario: Registration only
- GIVEN an empty container
- WHEN the module is registered
- THEN no token is resolved

#### Scenario: Fund an L1 address
- GIVEN the module and an L1 address A
- WHEN ICTT funding of A for amount M runs
- THEN A's L1 balance rises by M after relay

### Requirement: Demos doc uses real commands

The Demo 2 local steps in `docs/demos.md` MUST name only commands that exist, and state that the local run is for development and never the stage demo.

#### Scenario: Commands exist
- GIVEN each command in the Demo 2 local steps
- WHEN checked against package scripts
- THEN each exists

## Traceability

| Done-when box | Requirement |
|---|---|
| T8.3 script is idempotent | Idempotent treasury setup |
| T8.3 budget comes from the profile | Budget from the profile |
| T8.3 prints lane `Id` and remaining budget | Setup output |
| T8.4 tools trigger and track one payment end to end | Payment agent triggers and tracks |
| T8.4 module exposes ICTT funding for Demo 3 | Cross-chain module |
| T8.4 demos.md uses the real commands | Demos doc uses real commands |
