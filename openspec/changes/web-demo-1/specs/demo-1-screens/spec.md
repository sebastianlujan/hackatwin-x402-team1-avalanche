# Demo 1 Screens Specification

## Purpose

The `/demo-1` screen and the ERC-8004 identity card, driven by the agent event stream. Covers T10.6 (PRs 5 and 8) and
the first-checkpoint run start (PR 3).

## Requirements

### Requirement: Start and mode label

The screen MUST start a run only from an explicit button press, by POST. It MUST offer `Claude` and `Scripted`; `Scripted`
MUST be labeled as scripted on the control and on the run (from `run.started.llm`), and `Claude` MUST be disabled with a
reason when the server has no key. The button MUST be disabled while a run is active.

#### Scenario: Double click

- GIVEN an idle screen
- WHEN the button is pressed twice quickly
- THEN one POST is sent and the second press is ignored

#### Scenario: Scripted label

- GIVEN `run.started` with `llm: scripted`
- WHEN the screen renders it
- THEN a "Scripted" badge is visible for the whole run

#### Scenario: Preflight error

- GIVEN the POST answers with a failing command
- WHEN the screen shows the error
- THEN it displays the command text, for example `pnpm demo1:fund`

### Requirement: Reload resumes

On load the screen MUST attach to the active or most recent run and rebuild state from `seq` 1, without any POST.

#### Scenario: Reload mid run

- GIVEN a run is active and the page reloads
- WHEN it attaches
- THEN the timeline is rebuilt, new frames continue it, and no second payment occurs

### Requirement: Timeline beside the 402 to pay to 200 strip

The screen MUST show `llm.reasoning` and `llm.tool-call` events as an ordered timeline next to a strip of
`402 → pay → 200` driven by `payment.required`, `payment.signed`, and `resource.received`. Policy decisions and
`run.finished` reasons MUST appear in the timeline, a non-`done` reason as an error state.

#### Scenario: Happy order

- GIVEN events reasoning, tool-call, `payment.required`, `payment.signed`, `resource.received` 200
- WHEN rendered by the reducer and components
- THEN the timeline lists them in order and all three strip steps are complete

#### Scenario: Policy refusal

- GIVEN `policy.decision` allowed false, then `run.finished` reason `refusal`
- WHEN rendered
- THEN the strip stops at 402, the reason text is shown, and no step claims success

### Requirement: Quote panel

The panel MUST show the quote source (`curve` or `chainlink`), the rate, the ARGt amount, and the validity time, and the
text "market rate, not official". When `guarded` is true it MUST show a guard flag with a text label, not color alone.
Money MUST be formatted from `units` and `decimals` without floating point.

#### Scenario: Healthy

- GIVEN a quote with source `curve` and guarded false
- WHEN rendered
- THEN it shows `curve`, no guard flag, and "market rate, not official"

#### Scenario: Guarded

- GIVEN a quote with source `chainlink` and guarded true
- WHEN rendered
- THEN it shows `chainlink`, a text guard flag, and the same disclaimer

#### Scenario: No quote yet

- GIVEN no `payment.required` event
- WHEN rendered
- THEN an empty state explains the quote appears when the run starts

### Requirement: Balances and fork hashes without links

The screen MUST show agent and seller ARGt balances before and after the run and the amount moved, and every tx hash
from the fork (`payment.status`, `identity.feedback`) as plain monospace text labeled "fork". It MUST NOT render an explorer link for them.

#### Scenario: Fork hash

- GIVEN a `payment.status` event with a tx hash on chain 43114 from the fork
- WHEN rendered
- THEN the hash is shown with the "fork" label and the markup has no `<a>` for it

#### Scenario: Balance delta

- GIVEN before and after balances
- WHEN rendered
- THEN the moved amount equals the difference

### Requirement: Stream failure states

A dropped connection MUST show a reconnecting state and resume from the last `seq`. A decode failure MUST show an error.

#### Scenario: Drop

- GIVEN the connection closes before `run.finished`
- WHEN the client reconnects
- THEN it sends the last seen `seq` as `Last-Event-ID` and no frame is shown twice

### Requirement: No Demo 1 replay in the UI

The Demo 1 screen MUST NOT offer a replay (Q2).

#### Scenario: Controls

- GIVEN the `/demo-1` markup
- WHEN searched for a replay control
- THEN none exists

### Requirement: Identity card

The `/path/identity` screen MUST show the fork agent and seller ERC-8004 `agentId` and owner, read on the server. It MUST
not show reputation unless it was read; otherwise it states it is unavailable. When the fork is unreachable it MUST show
the last-known ids labeled "offline", never as live.

#### Scenario: Live

- GIVEN the fork answers
- WHEN the card renders
- THEN agent and seller ids and owners show with no offline label

#### Scenario: Fork down

- GIVEN the fork read fails
- WHEN the card renders
- THEN it shows the last-known values labeled "offline" and the page does not error

## Traceability

| Done-when box | Requirement |
|---|---|
| Reasoning and tool calls appear as a timeline next to the 402 → pay → 200 strip | Timeline beside the strip |
| The quote panel shows its source and "market rate, not official" | Quote panel |
| Balances and fork tx hashes show, without explorer links | Balances and fork hashes without links |
| (proposal) reload resumes without a second payment | Reload resumes; Start and mode label |
| (what) ERC-8004 identity card | Identity card |
