# Delta for Core Domain Ports (demo-2)

Base: core-di, shared-packages, then demo-1 deltas of `core-domain-ports` (not yet archived).

## MODIFIED Requirements

### Requirement: AgentEvent wire format

Every `AgentEvent` MUST carry a `version` field. In JSON, amounts MUST be base-unit decimal strings, never numbers. Serializing then parsing an event MUST round-trip equal. The `run.started` event MUST name its LLM as `claude` or `scripted`. `Hop.explorerUrl` MUST be optional. The `AgentEvent` base MUST allow an optional `simulated?: 'local-crosschain'` (not a `Hop` field); when present it MUST survive a round trip, and decoding MUST reject any other value.
(Previously: `explorerUrl` was required and no simulated marker existed.)

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

#### Scenario: Hop without link

- GIVEN a `hop` event with no `explorerUrl`
- WHEN serialized and parsed
- THEN it parses and `explorerUrl` is still absent

#### Scenario: Hop with link

- GIVEN a `hop` event with an `explorerUrl`
- WHEN serialized and parsed
- THEN the URL is identical

#### Scenario: Marker round trip

- GIVEN an event carrying the simulated marker
- WHEN serialized and parsed
- THEN the marker is preserved

#### Scenario: Marker absent

- GIVEN an event without the marker
- WHEN serialized and parsed
- THEN none is added

#### Scenario: Marker on the base

- GIVEN a non-hop event carrying the marker
- WHEN serialized and parsed
- THEN the marker is preserved

#### Scenario: Other marker value

- GIVEN JSON with `simulated: "fuji"`
- WHEN parsed
- THEN parsing fails with a readable error

### Requirement: Seven ports

Core MUST export interfaces `PaymentGateway`, `AgentIdentity`, `AgentPolicy`, `ChainClient`, `LLM`, `PriceOracle`, and `CrossChainMessenger`, with tokens for each. `ChainClient` MUST support block-pinned reads (see Block-pinned ChainClient reads). `ContractCall` MUST accept an optional `value?: bigint` (native value sent with a write).
(Previously: `ContractCall` had no `value` field.)

#### Scenario: Compile check

- GIVEN a class implementing each port
- WHEN the project typechecks
- THEN it compiles

#### Scenario: Pinned read in the port
- GIVEN a class implementing `ChainClient` without a `blockNumber` option or a block in its read result
- WHEN the project typechecks
- THEN it fails

#### Scenario: Call with value

- GIVEN a `ContractCall` with `value: 5n`
- WHEN it is passed to a `ChainClient` write
- THEN it typechecks and the fake records `5n`

#### Scenario: Call without value

- GIVEN a `ContractCall` with no `value`
- WHEN it is passed to a `ChainClient` write
- THEN it typechecks

## Traceability

| Done-when box | Requirement |
|---|---|
| Decision: local labeled simulated | AgentEvent wire format (marker) |
| T8.1 fee paid with the send | Seven ports (`ContractCall.value`) |
| Proposal: `Hop.explorerUrl` optional for local chains | AgentEvent wire format |
| T8.2 hops carry links where chains have an explorer | AgentEvent wire format (optional URL) |
| T5.8 runner emits `run.started` (kept) | AgentEvent wire format |
