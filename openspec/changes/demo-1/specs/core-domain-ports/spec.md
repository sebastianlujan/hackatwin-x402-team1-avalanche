# Delta for Core Domain Ports (demo-1)

Base: `openspec/changes/core-di/specs/core-domain-ports/spec.md`.

## MODIFIED Requirements

### Requirement: AgentEvent wire format

Every `AgentEvent` MUST carry a `version` field. In JSON, amounts MUST be base-unit decimal strings, never numbers. Serializing then parsing an event MUST round-trip equal. The `run.started` event MUST name its LLM as `claude` or `scripted`.
(Previously: `run.started` carried no LLM name.)

#### Scenario: Round trip

- GIVEN an event with an amount above 2^53
- WHEN it is serialized and parsed
- THEN the amount is identical and serialized as a string

#### Scenario: Unknown version

- GIVEN JSON with an unsupported `version`
- WHEN parsed
- THEN parsing fails with a readable error

#### Scenario: LLM named

- GIVEN a run with the scripted LLM
- WHEN `run.started` is emitted
- THEN it carries `llm: "scripted"`

#### Scenario: Unknown LLM

- GIVEN `run.started` JSON with `llm: "gpt"`
- WHEN parsed
- THEN parsing fails with a readable error

## Traceability

| Done-when box | Requirement |
|---|---|
| Risk: `--scripted` read as a C1 mock | AgentEvent wire format |
| T5.8 runner emits `run.started` | AgentEvent wire format |
