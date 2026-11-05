# Config Profiles Specification

## Purpose

`@hackatwin/config`: zod profile schemas and the only `process.env` reader.

## Requirements

### Requirement: Four profiles

`loadProfile(name, env = process.env)` MUST accept `cchain-fork`, `fuji-crosschain`, `twinpay-l1`, and `fuji-cchain` and return a typed, validated profile. Enums MUST hold only values the four profiles need now. Unknown names MUST fail listing valid names.

#### Scenario: Valid profile

- GIVEN a complete env record for `twinpay-l1`
- WHEN `loadProfile('twinpay-l1', env)` runs
- THEN a typed profile is returned

#### Scenario: Unknown profile

- GIVEN the name `mainnet`
- WHEN loaded
- THEN the error lists the four valid names

### Requirement: Sole environment reader

`loadProfile` MUST be the only code reading `process.env`; tests pass a record. `.env.example` MUST list every variable the schemas read, with no values.

#### Scenario: Env coverage

- GIVEN all schema variables
- WHEN compared with `.env.example`
- THEN each is listed, with empty values

### Requirement: Keystores, not keys

Profiles MUST reference keystores by name and a password file path per keystore. A raw private key or password value in env MUST be rejected.

#### Scenario: Raw key

- GIVEN env carries a 32-byte hex private key field
- WHEN loaded
- THEN loading fails and the error does not echo the value

### Requirement: Fork guard

`cchain-fork` MUST reject a non-loopback RPC URL at load (`localhost`, `127.0.0.1`, `::1` accepted).

#### Scenario: Remote RPC

- GIVEN `cchain-fork` with `https://api.avax.network/ext/bc/C/rpc`
- WHEN loaded
- THEN loading fails naming the field

### Requirement: Readable startup failure

An invalid profile MUST fail at load with one error listing each failing variable and the reason, never a raw zod dump.

#### Scenario: Two bad values

- GIVEN a missing RPC URL and a bad chain ID
- WHEN loaded
- THEN one error names both variables

## Traceability

| Done-when | Requirement |
|---|---|
| T3.4 profiles reference keystore names, never raw keys | Keystores, not keys |
| T3.4 invalid profile fails with a readable error | Four profiles; Readable startup failure; Fork guard |
| T3.4 `.env.example` lists every variable | Sole environment reader |
| M3 only the loader reads `process.env` | Sole environment reader |
