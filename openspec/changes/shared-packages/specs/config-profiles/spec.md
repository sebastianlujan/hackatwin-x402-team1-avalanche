# Delta for Config Profiles (core-di)

Base: `openspec/changes/core-di/specs/config-profiles/spec.md`.

## ADDED Requirements

### Requirement: Read-only RPC loader

`@hackatwin/config` MUST expose `loadRpcUrls(needed, env)` in `load-profile.ts` returning read-only RPC URLs for every live chain it is asked for (pricing and `chains:verify`). Each chain reads `<KEY>_RPC_URL` (registry key uppercased, `-` to `_`) and falls back to the registry `rpc.public` default. It MUST NOT require or return API keys, keystore names, or password paths. (SD2)

#### Scenario: No secrets needed
- GIVEN an empty env record
- WHEN the loader runs for Arbitrum and Base
- THEN it returns their registry default URLs

#### Scenario: Env overrides default
- GIVEN `BASE_RPC_URL` is set
- WHEN the loader runs for Base
- THEN it returns the env value

#### Scenario: Missing RPC
- GIVEN a needed chain with no env value and no registry default (e.g. `twinpay-l1` before T6.1)
- WHEN it runs
- THEN one error names that variable

#### Scenario: Invalid URL
- GIVEN a malformed Arbitrum URL
- WHEN it runs
- THEN the error names the variable and does not echo the value

## MODIFIED Requirements

### Requirement: Sole environment reader

`loadProfile` and the read-only RPC loader MUST be the only code reading `process.env` (both in `load-profile.ts`); tests pass a record. `.env.example` MUST list every variable the schemas and the read-only loader read, with no values; a comment line above each RPC variable MAY give its registry default (SD3).
(Previously: only `loadProfile` was named; the read-only loader variables are now covered.)

#### Scenario: Env coverage

- GIVEN all schema variables and the read-only loader variables
- WHEN compared with `.env.example`
- THEN each is listed, with empty values

#### Scenario: Single reader
- GIVEN the repository source
- WHEN scanned for `process.env`
- THEN it appears only in `load-profile.ts`

## Traceability

| Done-when box | Requirement |
|---|---|
| T4.3 read-only RPC, no secrets | Read-only RPC loader |
| T4.4/T4.5 pricing reads Arbitrum and Base | Read-only RPC loader |
| M3 only the loader reads `process.env` (kept) | Sole environment reader |
