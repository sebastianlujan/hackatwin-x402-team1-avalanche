# Claude LLM Specification

## Purpose

`LLM` port adapter over `@anthropic-ai/sdk`.

## Requirements

### Requirement: Auto tool choice and model

Requests MUST use `tool_choice: auto` and never a forced tool. The model MUST come from config, defaulting to `claude-sonnet-5-5`.

#### Scenario: Request shape
- GIVEN tools are registered
- WHEN a request is built
- THEN `tool_choice` is `auto` and the model is the default

#### Scenario: Config model
- GIVEN config sets another model
- WHEN a request is built
- THEN that model is used

### Requirement: Reply events

Reasoning summaries and tool calls MUST be emitted as `AgentEvent`s once per completed reply, in content order. Token streaming is not required. Live streaming applies only to events emitted while a tool runs, through the runner's `EventChannel`.

#### Scenario: Content order
- GIVEN a completed reply with a summary then a tool call
- WHEN handled
- THEN an `llm.reasoning` event precedes the `llm.tool-call` event

### Requirement: Refusal ends the run

A `refusal` stop reason MUST end the run with `run.finished` reason `refusal` and no further steps.

#### Scenario: Refusal
- GIVEN a response with stop reason `refusal`
- WHEN handled
- THEN `run.finished` with reason `refusal` is emitted and the stream ends

### Requirement: Backoff

Rate-limit, 529, and 5xx errors MUST be retried with bounded backoff (3 retries). When retries are exhausted the run MUST end with `run.finished` reason `error` and a message that never contains the key. A missing key MUST fail naming `ANTHROPIC_API_KEY`.

#### Scenario: Transient
- GIVEN one 529 then success
- WHEN called
- THEN the retry succeeds

#### Scenario: Exhausted
- GIVEN errors on every attempt
- WHEN the limit is reached
- THEN `run.finished` with reason `error` is emitted

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.7 `tool_choice: auto` | Auto tool choice and model |
| T5.7 summaries and calls stream as events | Reply events (per completed reply; tool-run events stream live through the `EventChannel`) |
| T5.7 refusal ends run | Refusal ends the run |
| Risk: LLM outage, retries | Backoff |
