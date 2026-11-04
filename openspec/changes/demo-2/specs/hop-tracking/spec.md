# Hop Tracking Specification

## Purpose

T8.2: map the CCIP send, hub and receiver `StatusChanged`, and the ICTT call result into `hop` events, resumable from a message ID.

## Requirements

### Requirement: Event mapping

The tracker MUST emit each status at most once, with fixed hop indices 0 to 4: 0 the CCIP send (transport `local`), 1 `Pending`, 2 `Dispatched`, 3 `Received`, 4 `Settled` or `Rejected`. The ICTT call result MUST NOT be its own hop on success, and a `CallFailed` MUST map to the `Rejected` hop. A broker `MessageRejected` (payer mismatch or hub refusal) MUST map to the index 4 `Rejected` hop carrying the reason from the event, and hops 1 to 3 MUST NOT be emitted for that run. Events MUST carry the transaction hash and chain ID.

#### Scenario: Happy path
- GIVEN recorded logs of a payment that settles
- WHEN tracked
- THEN hops are send, `Pending`, `Dispatched`, `Received`, `Settled` at indices 0 to 4, each once, and no ICTT hop exists

#### Scenario: Rejected
- GIVEN recorded logs ending in `Rejected`
- WHEN tracked
- THEN the hop at index 4 is `Rejected` and no `Settled` hop exists

#### Scenario: ICTT failure
- GIVEN a `CallFailed` log
- WHEN tracked
- THEN one `Rejected` hop is emitted at index 4 and no separate failure hop exists

#### Scenario: Broker rejection
- GIVEN a CCIP message from a mismatched payer
- WHEN the tracker follows it
- THEN it emits hop 0 send and hop 4 `Rejected` with the broker reason, and no `Pending`, `Dispatched`, or `Received` hop

### Requirement: One event per hop

A transition seen twice (duplicate log or repeated poll) MUST NOT produce a second event.

#### Scenario: Duplicate log
- GIVEN the same `StatusChanged` log delivered twice
- WHEN tracked
- THEN one hop event is emitted

### Requirement: Local hops carry no explorer link

For local chains the tracker MUST omit `explorerUrl` and set the simulated marker. For read-write chains it MUST include the explorer link.

#### Scenario: Local
- GIVEN local chain logs
- WHEN tracked
- THEN no hop has `explorerUrl` and each event carries `simulated: 'local-crosschain'`

#### Scenario: Fuji
- GIVEN a log on chain key `fuji`
- WHEN tracked
- THEN the hop carries the Fuji explorer URL

### Requirement: Resume from a message ID

Given a message ID, tracking MUST resume from the on-chain state and emit only hops not yet emitted for it.

#### Scenario: Resume mid-flight
- GIVEN hops 0 and 1 already emitted and logs up to `Received`
- WHEN tracking resumes from the message ID
- THEN only indices 3 and 4 (`Received`, `Settled`) are emitted

#### Scenario: Unknown ID
- GIVEN a message ID with no logs
- WHEN tracking resumes
- THEN it emits nothing and reports not found

### Requirement: Replay of recorded logs

Unit tests MUST replay logs recorded from the local run, with no network.

#### Scenario: Fixture replay
- GIVEN the recorded log fixture
- WHEN the tracker maps it
- THEN output equals the expected hop list

## Traceability

| Done-when box | Requirement |
|---|---|
| T8.2 each hop event carries explorer links (local: absent, labeled) | Local hops carry no explorer link |
| T8.2 tracking resumes from a message ID | Resume from a message ID |
| T8.2 unit tests replay recorded logs | Replay of recorded logs |
| T8.2 map statuses to hop events | Event mapping; One event per hop |
