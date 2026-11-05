# Demo 1 Buyer Specification

## Purpose

Buyer agent, `registerX402Module`, `pnpm demo1`, and the protocol E2E.

## Requirements

### Requirement: Buyer tools

The buyer MUST expose tools `quote`, `buy`, and `rate_seller`. `buy` MUST cap the ARGt amount at its own quote times the per-payment cap, never the seller's rate.

#### Scenario: Cap from own quote
- GIVEN the buyer's quote is 1658 ARGt per USD and the cap is 1 USD
- WHEN the seller's 402 asks above 1658 ARGt
- THEN `buy` refuses and no payment is signed

#### Scenario: Rate after 200 only
- GIVEN a 200 response
- WHEN the run continues
- THEN `rate_seller` posts one positive score to the seller's `agentId`; on any failure it posts none

### Requirement: `pnpm demo1` with Claude

`pnpm demo1` MUST run the buyer on Claude and print the sequence 402, policy, signature, 200, feedback, with ARGt balances before and after. A missing key MUST fail fast naming `ANTHROPIC_API_KEY`.

#### Scenario: Full run
- GIVEN a funded fork, services up, and a key
- WHEN `pnpm demo1` runs
- THEN the sequence prints with before and after balances

#### Scenario: No key
- GIVEN `ANTHROPIC_API_KEY` is unset
- WHEN `pnpm demo1` runs
- THEN it exits non-zero naming the variable before any chain call

### Requirement: `--scripted` mode

`pnpm demo1 --scripted` MUST run the scripted plan with zero secrets while chain and payment stay real. `run.started` MUST name `scripted`.

#### Scenario: No secrets
- GIVEN no API key and a funded fork
- WHEN `pnpm demo1 --scripted` runs
- THEN the same sequence prints and `run.started` shows `scripted`

#### Scenario: Off loopback
- GIVEN a non-anvil RPC
- WHEN it runs
- THEN it refuses to write

### Requirement: Module and runbook

`registerX402Module(container, config)` MUST be importable as a workspace dependency, and demos.md Demo 1 steps MUST use the real commands.

#### Scenario: Import
- GIVEN another workspace package
- WHEN it imports the module
- THEN it typechecks

#### Scenario: Runbook
- GIVEN demos.md Demo 1
- WHEN scanned for commands
- THEN each is a script in `package.json`

### Requirement: Protocol E2E

A Vitest E2E on the pinned fork, with the scripted LLM and a fixed-rate oracle swapped by DI, MUST assert 402 to 200, ARGt moved equals the quote, and one feedback event on the seller's `agentId`. CI MUST cache the Foundry RPC cache keyed by chain and block.

#### Scenario: Paid
- GIVEN the fork at `N` and funded agent
- WHEN the E2E runs
- THEN seller balance rises and agent balance falls by exactly the quote

#### Scenario: Feedback
- GIVEN the run ended with 200
- WHEN events are read
- THEN one feedback event names the seller's `agentId`

#### Scenario: Cache key
- GIVEN the CI config
- WHEN inspected
- THEN the cache key contains chain ID and `N`

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.9 `pnpm demo1` full sequence with balances | `pnpm demo1` with Claude; `--scripted` mode |
| T5.9 module importable | Module and runbook |
| T5.9 demos.md real commands | Module and runbook |
| T5.9 tools quote, buy, rate seller | Buyer tools |
| T5.10 402 to 200, ARGt equals quote | Protocol E2E |
| T5.10 feedback on seller `agentId` | Protocol E2E; Buyer tools |
| T5.10 CI cache by chain and block | Protocol E2E |
