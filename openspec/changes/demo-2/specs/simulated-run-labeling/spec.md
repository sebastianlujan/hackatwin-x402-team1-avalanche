# Simulated Run Labeling Specification

## Purpose

Binding decision (2026-11-04): the local profile is for development and tests only and is never the live demo. Every local output is labeled simulated and never shows Sepolia or CCIP Explorer links.

## Requirements

### Requirement: Simulated marker on every local event

Every `AgentEvent` emitted during a `local-crosschain` run MUST carry `simulated: 'local-crosschain'` on the `AgentEvent` base (not on the `Hop` object), stamped by the event channel. Events from other profiles MUST NOT carry it.

#### Scenario: Local run
- GIVEN a run on `local-crosschain`
- WHEN its events are collected
- THEN every event carries the marker

#### Scenario: Other profile
- GIVEN a run on `cchain-fork`
- WHEN its events are collected
- THEN none carries the marker

#### Scenario: Stamped by the channel
- GIVEN a producer that emits an event without the field
- WHEN it passes the local event channel
- THEN the delivered event carries `simulated: 'local-crosschain'`

#### Scenario: Other value rejected
- GIVEN event JSON with `simulated: "fuji"`
- WHEN decoded
- THEN decoding fails with a readable error

### Requirement: CLI first line

The first line of CLI output for a local run MUST be exactly `SIMULATED (local-crosschain)`.

#### Scenario: First line
- GIVEN a local CLI run
- WHEN stdout is captured
- THEN line 1 equals `SIMULATED (local-crosschain)`

### Requirement: No live links or names

Local output and events MUST NOT contain `sepolia`, `ccip.chain.link`, `snowtrace`, or any `https://` link (case-insensitive).

#### Scenario: Scan
- GIVEN the full output and events of a local run
- WHEN scanned for the four patterns
- THEN there are no matches

#### Scenario: Hop without link
- GIVEN a local hop event
- WHEN `explorerUrl` is read
- THEN it is absent

### Requirement: Labels come from the profile

Labels MUST be derived from the loaded profile, never from a selector lookup. The simulator selector `16015286601757825753` equals Sepolia's and MUST NOT select a label or a chain name.

#### Scenario: Same selector
- GIVEN a local run whose source selector is `16015286601757825753`
- WHEN labels are produced
- THEN the source is labeled by the profile, and "Sepolia" never appears

#### Scenario: Selector lookup banned
- GIVEN the local label code
- WHEN searched for selector-to-name lookups
- THEN none exist

### Requirement: Local runs are never replays

A local run MUST NOT be writable to `apps/web/recordings/`. The save path MUST refuse it (enforced, not only labeled).

#### Scenario: Save refused
- GIVEN events carrying the simulated marker
- WHEN a save to `apps/web/recordings/` is attempted
- THEN it fails with an error and no file is written

#### Scenario: Real run saves
- GIVEN events without the marker
- WHEN the same save is attempted
- THEN it succeeds

## Traceability

| Done-when box | Requirement |
|---|---|
| Decision: local labeled simulated | Simulated marker on every local event; CLI first line |
| Decision: no Sepolia or CCIP Explorer link | No live links or names |
| Proposal: selector equals Sepolia's | Labels come from the profile |
| Proposal: never written to recordings | Local runs are never replays |
| Success: no live explorer or CCIP Explorer link | No live links or names |
