# Agent Runner Specification

## Purpose

`createAgent({ llm, tools, policy })` shared by every agent.

## Requirements

### Requirement: Event stream

`createAgent` MUST return an `AsyncIterable<AgentEvent>` that begins with `run.started` and ends with a terminal event.

#### Scenario: Run
- GIVEN a scripted LLM with one tool call then a final answer
- WHEN iterated
- THEN events run from `run.started` to a terminal event

### Requirement: Typed tools per agent

Tools MUST be typed and registered per agent. A call to an unregistered tool or with input that fails its schema MUST end the run with `run.finished` reason `error` naming the tool, and MUST NOT execute. Unknown input keys are stripped, not errors.

#### Scenario: Unknown tool
- GIVEN the LLM calls `delete_all`
- WHEN handled
- THEN `run.finished` with reason `error` is emitted and nothing runs

#### Scenario: Invalid input
- GIVEN a tool call whose input fails its schema
- WHEN handled
- THEN `run.finished` with reason `error` is emitted and the tool does not run

### Requirement: Max-steps guard

The runner MUST stop after the configured max steps (default 8) with `run.finished` reason `max-steps` and a message naming the limit.

#### Scenario: Runaway
- GIVEN an LLM that always calls a tool and max steps 3
- WHEN run
- THEN it stops after 3 steps with `run.finished` reason `max-steps`

### Requirement: Scripted fake in unit tests

Unit tests MUST use the scripted LLM fake and need no network.

#### Scenario: Offline
- GIVEN the unit suite
- WHEN run offline
- THEN it passes

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.8 tools typed, per agent | Typed tools per agent |
| T5.8 max-steps guard | Max-steps guard |
| T5.8 tests use scripted LLM | Scripted fake in unit tests; Event stream |
