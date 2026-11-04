# Agent Event Stream Specification

## Purpose

A server run store and an SSE feed that carry `AgentEvent`s from a Demo 1 run, live or replayed, to the browser with one
envelope. Covers T10.5 (PRs 2 and 3). `AgentEvent` itself is unchanged.

## Requirements

### Requirement: One envelope for live and replay

Every SSE frame MUST carry an envelope `{ seq, source, event }`: `seq` a per-run integer starting at 1 with no gaps,
`source` either `live` or `replay`, and `event` an `AgentEvent` encoded with `encodeAgentEvent` and decoded in the
client with `decodeAgentEvent` (amounts and `agentId` as decimal strings). The SSE `id` field MUST equal `seq`.

#### Scenario: Live frame round trip

- GIVEN a live run that emits `payment.required` with bigint amounts
- WHEN a client reads its frame
- THEN `decodeAgentEvent(frame.event)` equals the emitted event and `source` is `live`

#### Scenario: Same schema for both sources

- GIVEN a live run and a replay of the same events
- WHEN their frames are validated by one schema
- THEN both pass and differ only in `source`

#### Scenario: Unknown version

- GIVEN a frame whose event has `version: 2`
- WHEN the client decodes it
- THEN decoding throws `AgentEventError` and the UI shows an error state, not a blank

### Requirement: Runs start only by POST

`POST /api/runs` MUST be the only way to start a run. GET, HEAD, and SSE connections MUST NOT start, restart, or
re-pay a run. The body selects `llm` as `claude` or `scripted`.

#### Scenario: GET never starts

- GIVEN no active run
- WHEN a client calls GET on the events route or reloads the page
- THEN no run is created and no payment is made

#### Scenario: Claude without a key

- GIVEN the server has no `ANTHROPIC_API_KEY`
- WHEN a client POSTs `llm: claude`
- THEN the response is a 4xx naming the variable and no chain call happens

### Requirement: One active run

The store MUST allow at most one active run. A POST while a run is active MUST NOT start another and MUST answer 409
with the active run id.

#### Scenario: Double click

- GIVEN a run is active
- WHEN two POSTs arrive back to back
- THEN exactly one run exists and the fake payment gateway saw one purchase

#### Scenario: After the run

- GIVEN the active run emitted `run.finished`
- WHEN a client POSTs again
- THEN a new run starts with a new id

### Requirement: Resume from Last-Event-ID

The events route MUST replay buffered frames with `seq` greater than `Last-Event-ID`, then continue live, without
re-running the agent. With no header it MUST start at `seq` 1. A finished run MUST replay its buffer and close. An unknown
run id MUST answer 404. A client disconnect MUST NOT cancel the run.

#### Scenario: Reconnect mid run

- GIVEN a run with frames 1 to 7 buffered and a client that saw 4
- WHEN it reconnects with `Last-Event-ID: 4`
- THEN it receives 5, 6, 7 and then live frames, and the payment count is unchanged

#### Scenario: Dev reload

- GIVEN a route module is reloaded in dev
- WHEN the client reconnects
- THEN the same run and buffer are found

### Requirement: Stream transport

The route MUST run on the Node runtime, be dynamic, send `Cache-Control: no-cache, no-transform`, and send heartbeat
comments while idle.

#### Scenario: Headers

- GIVEN an events request
- WHEN the response starts
- THEN the content type is `text/event-stream` and the cache header contains `no-transform`

### Requirement: Preflight and attachment

A POST MUST run the Demo 1 preflight before creating a run. A failure MUST create no run and answer with the fixing
command (for example `pnpm demo1:fund`). The server MUST attach only to services already running and MUST NOT spawn anvil.

#### Scenario: Seller down

- GIVEN the seller service is not running
- WHEN a client POSTs
- THEN the response names `pnpm demo1:seller`, no run exists, and no process is spawned

#### Scenario: Fork guard refusal

- GIVEN the guarded client reports a refusal
- WHEN a client POSTs
- THEN the start fails with that refusal and no write is attempted

### Requirement: Failed runs end the stream

A run that throws MUST end its stream with `run.finished` and reason `error`, and free the active slot.

#### Scenario: Throw mid run

- GIVEN the agent throws after frame 3
- WHEN the run ends
- THEN frame 4 is `run.finished` with reason `error` and a new POST is accepted

### Requirement: Replay source

A replay source MUST read a JSONL file of encoded `AgentEvent`s and emit the same envelope with `source: replay`,
touching no chain, container, or payment code. The UI MUST label replays on screen. A Demo 1 replay MUST NOT be
reachable from the Demo 1 screen (Q2); only a test fixture ships.

#### Scenario: Replay labeled

- GIVEN the fixture file
- WHEN it is replayed
- THEN every frame has `source: replay` and the screen shows a "Replay" label

#### Scenario: Bad line

- GIVEN a JSONL line that is not a valid event
- WHEN the replay reads it
- THEN the replay ends with a visible error naming the line number

## Traceability

| Done-when box | Requirement |
|---|---|
| Live and replay share one schema and one UI | One envelope for live and replay |
| Replays are labeled on screen | Replay source (label rule; the on-screen box closes with `/demo-2`, T10.7) |
| A dropped stream resumes without rerunning payments | Runs start only by POST; One active run; Resume from Last-Event-ID |
| (proposal) fork guard and services | Preflight and attachment |
