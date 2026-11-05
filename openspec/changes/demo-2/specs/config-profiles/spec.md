# Delta for Config Profiles (demo-2)

Base: core-di, shared-packages, then demo-1 deltas of `config-profiles` (not yet archived).

## RENAMED Requirements

### Requirement: Four profiles → Five profiles

(Reason: `local-crosschain` is a fifth profile.)
(Migration: tests and docs that say "four profiles" or list four names update to five.)

## MODIFIED Requirements

### Requirement: Five profiles

`loadProfile(name, env = process.env, { llm })` MUST accept `cchain-fork`, `fuji-crosschain`, `twinpay-l1`, `fuji-cchain`, and `local-crosschain` and return a typed, validated profile. Enums MUST hold only values the five profiles need now. Unknown names MUST fail listing valid names. `llm` is `'claude'`, `'scripted'`, or omitted. `ANTHROPIC_API_KEY` MUST be required only when `llm` is `'claude'`; with `'scripted'` or with `llm` omitted (a process that runs no LLM) it MUST NOT be required. The Claude model defaults to `claude-sonnet-5-5`.
(Previously: four profiles, `local-crosschain` unknown.)

#### Scenario: Valid profile

- GIVEN a complete env record for `twinpay-l1`
- WHEN `loadProfile('twinpay-l1', env)` runs
- THEN a typed profile is returned

#### Scenario: Unknown profile

- GIVEN the name `mainnet`
- WHEN loaded
- THEN the error lists the five valid names

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

#### Scenario: Local profile loads

- GIVEN `LOCAL_HUB_RPC_URL` and `LOCAL_L1_RPC_URL` set to loopback URLs
- WHEN `loadProfile('local-crosschain', env, { llm: 'scripted' })` runs
- THEN a typed profile is returned with static `ccip: 'simulated'`

## ADDED Requirements

### Requirement: Local profile keys

`local-crosschain` MUST read only `LOCAL_HUB_RPC_URL` and `LOCAL_L1_RPC_URL` for RPCs, never `SEPOLIA_RPC_URL`, `FUJI_RPC_URL`, or `TWINPAY_L1_RPC_URL`, so no live-network variable points at a local node. Both keys MUST be listed in `.env.example` with empty values. The profile MUST need no keystore, no secret, and no funded account. It MUST carry the treasury budget.

#### Scenario: Live keys ignored
- GIVEN env with `FUJI_RPC_URL` set and no `LOCAL_HUB_RPC_URL`
- WHEN `local-crosschain` is loaded
- THEN loading fails naming `LOCAL_HUB_RPC_URL`

#### Scenario: Env example
- GIVEN the new keys
- WHEN compared with `.env.example`
- THEN both are listed with empty values

#### Scenario: Two bad values
- GIVEN both RPC keys missing
- WHEN loaded
- THEN one error names both variables

### Requirement: Local loopback guard

`local-crosschain` MUST reject a non-loopback value for either RPC key at load (`localhost`, `127.0.0.1`, `::1` accepted). Its local chain IDs are validated statics of the profile (statics schema, not env keys), and the schema MUST refuse 43113, 43114, and 11155111.

#### Scenario: Remote RPC
- GIVEN `LOCAL_L1_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc`
- WHEN loaded
- THEN loading fails naming `LOCAL_L1_RPC_URL` and does not echo the value

#### Scenario: Live chain ID
- GIVEN the statics schema and a chain ID of 43113, 43114, or 11155111
- WHEN the statics are validated
- THEN validation fails naming the chain ID field

#### Scenario: No chain ID env key
- GIVEN env that sets a chain ID variable for the local profile
- WHEN loaded
- THEN the value is ignored and the static is used

## Traceability

| Done-when box | Requirement |
|---|---|
| Success: no secrets, RPCs, or funds | Local profile keys; Five profiles |
| Proposal S3 loopback keys | Local profile keys; Local loopback guard |
| T8.3 budget comes from the profile | Local profile keys |
| T5.9 zero-secret scripted run (kept) | Five profiles |
