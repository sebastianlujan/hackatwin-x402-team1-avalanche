# Delta for Chain Client (demo-1)

Base: `openspec/changes/shared-packages/specs/chain-client/spec.md`.

## MODIFIED Requirements

### Requirement: 43114 anvil guard

Writes on chain ID 43114 MUST be refused unless the RPC is loopback AND `web3_clientVersion` reports anvil, checked at startup. The same rule MUST apply to every client handed to an SDK signer (x402, ERC-8004) and to anvil cheat calls (`anvil_impersonateAccount`, `anvil_setBalance`, `anvil_setCode`); packages MUST obtain such clients only from `packages/chains`.
(Previously: the rule covered writes only, with no mention of SDK signers or anvil cheats.)

#### Scenario: Public RPC
- GIVEN chain 43114 with `https://api.avax.network/ext/bc/C/rpc`
- WHEN the client starts and a write is attempted
- THEN the write is refused

#### Scenario: Loopback not anvil
- GIVEN a loopback RPC whose `web3_clientVersion` lacks "anvil"
- WHEN a write is attempted
- THEN it is refused

#### Scenario: Local anvil
- GIVEN a loopback RPC reporting anvil
- WHEN a write is attempted
- THEN it is allowed

#### Scenario: SDK signer on public RPC
- GIVEN a signer client for 43114 on a public RPC
- WHEN an SDK sends a transaction through it
- THEN it is refused and no RPC write method is called

#### Scenario: Cheat on non-anvil
- GIVEN a loopback RPC lacking "anvil"
- WHEN `anvil_impersonateAccount` is called
- THEN it is refused

#### Scenario: Cheat on local anvil
- GIVEN a loopback RPC reporting anvil
- WHEN `anvil_impersonateAccount` is called
- THEN it is allowed

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.1 mint by impersonation only on local anvil | 43114 anvil guard |
| T5.3 facilitator signs through guarded client | 43114 anvil guard |
| T5.5 client signer is guarded | 43114 anvil guard |
| Success: no write off loopback anvil | 43114 anvil guard |
