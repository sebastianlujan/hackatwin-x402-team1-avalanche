# Delta for Config Profiles (demo-1)

Base: `openspec/changes/core-di/specs/config-profiles/spec.md` (plus the shared-packages delta).

## MODIFIED Requirements

### Requirement: Four profiles

`loadProfile(name, env = process.env, { llm })` MUST accept `cchain-fork`, `fuji-crosschain`, `twinpay-l1`, and `fuji-cchain` and return a typed, validated profile. Enums MUST hold only values the four profiles need now. Unknown names MUST fail listing valid names. `llm` is `'claude'`, `'scripted'`, or omitted. `ANTHROPIC_API_KEY` MUST be required only when `llm` is `'claude'`; with `'scripted'` or with `llm` omitted (a process that runs no LLM) it MUST NOT be required. The Claude model defaults to `claude-sonnet-5-5`.
(Previously: `ANTHROPIC_API_KEY` was required by every profile.)

#### Scenario: Valid profile

- GIVEN a complete env record for `twinpay-l1`
- WHEN `loadProfile('twinpay-l1', env)` runs
- THEN a typed profile is returned

#### Scenario: Unknown profile

- GIVEN the name `mainnet`
- WHEN loaded
- THEN the error lists the four valid names

#### Scenario: Claude selected without key

- GIVEN `cchain-fork` with the Claude LLM and no `ANTHROPIC_API_KEY`
- WHEN loaded
- THEN loading fails naming `ANTHROPIC_API_KEY`

#### Scenario: Scripted without key

- GIVEN `cchain-fork` with the scripted LLM and no `ANTHROPIC_API_KEY`
- WHEN loaded
- THEN a typed profile is returned

#### Scenario: No LLM selected

- GIVEN `cchain-fork` loaded without `llm` and no `ANTHROPIC_API_KEY`
- WHEN loaded
- THEN a typed profile without an `llm` field is returned

### Requirement: Keystores, not keys

Profiles MUST reference keystores by name and a password file path per keystore. An optional absolute `KEYSTORE_DIR` MAY locate them; a relative value MUST be rejected. A raw private key or password value in env MUST be rejected.
(Previously: no keystore directory variable existed.)

#### Scenario: Raw key

- GIVEN env carries a 32-byte hex private key field
- WHEN loaded
- THEN loading fails and the error does not echo the value

#### Scenario: Absolute dir

- GIVEN `KEYSTORE_DIR=/abs/.demo1`
- WHEN loaded
- THEN the profile carries that directory

#### Scenario: Relative dir

- GIVEN `KEYSTORE_DIR=.demo1`
- WHEN loaded
- THEN loading fails naming `KEYSTORE_DIR`

### Requirement: Fork guard

`cchain-fork` MUST reject a non-loopback RPC URL at load (`localhost`, `127.0.0.1`, `::1` accepted). It MUST also record `forkBlock`, the pinned executed block `N`, from the code static `CCHAIN_FORK_BLOCK`, and its statics schema MUST accept only a positive integer.
(Previously: no fork block was recorded.)

#### Scenario: Remote RPC

- GIVEN `cchain-fork` with `https://api.avax.network/ext/bc/C/rpc`
- WHEN loaded
- THEN loading fails naming the field

#### Scenario: Fork block

- GIVEN the static `CCHAIN_FORK_BLOCK`
- WHEN `cchain-fork` is loaded
- THEN the profile reports `forkBlock` equal to it

#### Scenario: Invalid fork block

- GIVEN the `cchain-fork` statics schema and a `forkBlock` that is missing, zero, or negative
- WHEN the statics are validated
- THEN validation fails naming `forkBlock`

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.1 `N` recorded in `cchain-fork` | Fork guard |
| T5.9 `pnpm demo1 --scripted` needs zero secrets | Four profiles |
| T5.1 role keystores in `.demo1/` | Keystores, not keys |
