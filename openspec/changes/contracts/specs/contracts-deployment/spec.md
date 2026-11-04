# Contracts Deployment Specification

## Purpose

Registry-driven `forge script` deployments for the hub, messenger, and broker (Fuji) and the receiver (L1), proven by dry-runs only (T7.10, C1). Nothing is broadcast by this change.

## Errors

Declared in the abstract `Deploy` base: `Deploy_UnsupportedChain(uint256 chainId)`, `Deploy_ParamNotFound(string key, string entry)`, `Deploy_NonceMismatch(uint256 expected, uint256 actual)`, `Deploy_AddressMismatch(address expected, address actual)`. Reader errors: `Registry_UnknownChainId`, `Registry_EntryNotFound`, `Registry_InvalidSelector` (chain-registry delta).

## Requirements

### Requirement: Two read-only input sources

Scripts MUST map `block.chainid` to a registry key and read every chain fact (contract addresses, blockchain IDs, CCIP selectors) through the forge registry reader. Every deployment parameter (deployers, owners, gas limits, fallback recipient, allowlists, the receiver deployer and its nonce) MUST come from `packages/contracts/script/params/<chainKey>.json`. The registry keeps verified facts only (ADR 0011). No address, blockchain ID, or selector literal MUST appear in Solidity under `src/` or `script/`. A missing registry entry (including the L1 chain ID, the ICTT transferrers, and the L1 blockchain ID) MUST abort with `Registry_EntryNotFound(key, entry)`, and a missing parameter with `Deploy_ParamNotFound(key, entry)`, before any transaction.

#### Scenario: Fuji inputs
- GIVEN chain ID 43113, a registry with all required Fuji and L1 facts, and a Fuji params file
- WHEN the Fuji script runs as a dry-run
- THEN it resolves router, token, transferrer, and L1 blockchain ID from the registry, and deployer, gas limits, and fallback recipient from params

#### Scenario: Missing fact
- GIVEN the registry lacks a required entry
- WHEN a script runs
- THEN it reverts `Registry_EntryNotFound` naming the chain key and entry, with zero transactions simulated

#### Scenario: Missing parameter
- GIVEN no params file or no required parameter for the chain
- WHEN a script runs
- THEN it reverts `Deploy_ParamNotFound` naming the key and entry, with zero transactions simulated

#### Scenario: L1 not yet registered
- GIVEN `twinpay-l1` has no chain ID
- WHEN the L1 script runs against the real registry
- THEN it fails fast with `Registry_EntryNotFound('twinpay-l1', 'chainId')`

### Requirement: Supported chains only

Scripts MUST revert `Deploy_UnsupportedChain(chainId)` for any chain whose registry key is not `fuji` (Fuji script) or `twinpay-l1` (L1 script), including 43114.

#### Scenario: Mainnet fork
- GIVEN chain ID 43114
- WHEN either script runs
- THEN it reverts `Deploy_UnsupportedChain(43114)`

### Requirement: Dry-run by default, keystores only

Without `--broadcast` a script MUST send nothing and write no file. The signer MUST be bound to the params deployer address with `vm.startBroadcast(deployer)` and sign through `--account <keystore>`; scripts MUST NOT read a private key from the environment or accept one as an argument. No workflow or script MUST pass `--broadcast` in this change.

#### Scenario: Dry-run writes nothing
- GIVEN a dry-run
- WHEN it finishes
- THEN no transaction was broadcast and `packages/chains/deployments/` is unchanged

#### Scenario: No raw keys
- GIVEN `script/**` and `.github/workflows/**`
- WHEN searched for `PRIVATE_KEY`, `--private-key`, and `--broadcast`
- THEN there are no matches

### Requirement: Deployment records only when broadcasting

When broadcasting, a script MUST write `packages/chains/deployments/<chainKey>.json` with chain ID, deployer, and each deployed contract address; the Fuji record also holds the receiver deployer, its nonce, and the predicted receiver. The write MUST be gated by the `ScriptBroadcast` context, and the JSON MUST come from a serializer function. Because nothing passes `--broadcast`, tests cover the serializer and the gate, not a broadcast run. File write permission MUST be limited to the deployments directory; the registry, params, and fixtures stay read-only.

#### Scenario: Serializer output
- GIVEN deployed addresses from a script's `deploy` function
- WHEN the serializer runs
- THEN its JSON lists the chain ID, the deployer, and every deployed address for that chain

#### Scenario: Gate closed outside broadcast
- GIVEN a test or dry-run context
- WHEN the script finishes
- THEN the record write is skipped and no file changes

#### Scenario: Permissions scoped
- GIVEN `fs_permissions`
- WHEN read
- THEN write is granted only to the deployments directory

### Requirement: Cross-chain address agreement

The messenger needs the receiver address and the receiver needs the messenger address; both stay immutable (ADR 0010). The Fuji script MUST give the messenger `computeCreateAddress(receiverDeployer, nonce)` from params. Before deploying, the L1 script MUST assert that the receiver deployer's nonce equals the params nonce (`Deploy_NonceMismatch`) and that the predicted address equals the Fuji record (`Deploy_AddressMismatch`); after deploying, it MUST assert the receiver address equals the prediction. Each script MUST split file reads (`run`) from deployment logic (`deploy(inputs)` returning addresses).

#### Scenario: Addresses agree
- GIVEN fixture inputs and one test that calls the Fuji `deploy`, then the L1 `deploy` with the Fuji result
- WHEN both complete
- THEN the messenger's configured receiver equals the L1 receiver address and the receiver's configured origin sender equals the Fuji messenger address

#### Scenario: Nonce moved
- GIVEN the receiver deployer's nonce differs from the params nonce
- WHEN the L1 script runs
- THEN it reverts `Deploy_NonceMismatch` before any deployment

#### Scenario: Stale record
- GIVEN a Fuji record whose predicted receiver differs from the computed address
- WHEN the L1 script runs
- THEN it reverts `Deploy_AddressMismatch` before any deployment

### Requirement: Dry-run environments

CI MUST dry-run the Fuji script against a Fuji fork and the L1 script on anvil. Both use fixture registry, params, and Fuji record files that live only under `packages/contracts/test/fixtures`, never under `packages/chains`, because the L1 and its ICTT pair do not exist yet. The reader MUST accept a registry directory input (`CHAIN_REGISTRY_DIR`), and the params and deployments directories MUST be selectable the same way. Fixture facts copied from the real registry MUST be asserted equal to it.

#### Scenario: Fuji fork
- GIVEN a Fuji fork RPC and the fixtures
- WHEN CI runs the Fuji dry-run
- THEN it succeeds with no broadcast

#### Scenario: L1 on anvil
- GIVEN anvil and the fixtures
- WHEN CI runs the L1 dry-run
- THEN it succeeds and asserts the cross-chain addresses

#### Scenario: Fixture drift
- GIVEN a fixture fact that differs from the real registry
- WHEN the fixture test runs
- THEN it fails

### Requirement: Verification templates

Documented verification commands MUST target Snowtrace for Fuji and the Builder Hub verifier for the L1, reuse the build's compiler and EVM settings, and mark the L1 verifier as unverified until used.

#### Scenario: Templates present
- GIVEN the deployment docs
- WHEN read
- THEN both commands exist, use solc `0.8.30` and `cancun`, and the L1 one is labeled unverified

### Requirement: Allowlist configuration

The scripts MUST configure broker pairs (source chain key, sender, bound payer; the selector comes from the registry) and receiver merchants only when they are present in params, and MUST log when none are configured. They MUST NOT invent a sender, payer, or merchant.

#### Scenario: No allowlist entry
- GIVEN no broker pair in params
- WHEN the Fuji dry-run runs
- THEN no allowlist call is made and a log line says so

#### Scenario: Pair from params
- GIVEN a params pair `(sepolia, sender X, payer P)`
- WHEN the Fuji script runs
- THEN it calls `setAllowedSender(selector of sepolia, X, P)` with the selector read from the registry

## Traceability

| Done-when box | Requirement |
|---|---|
| T7.10 scripts map `block.chainid` to registry parameters | Two read-only input sources; Supported chains only |
| T7.10 CI dry-runs against Fuji and L1 forks | Dry-run environments; Cross-chain address agreement |
| T7.10 verification targets Snowtrace and Builder Hub | Verification templates |
| T7.10 `--account`, writing deployment JSON back | Dry-run by default, keystores only; Deployment records only when broadcasting |
| Proposal: nothing hardcoded, nothing broadcast | Two read-only input sources; Dry-run by default, keystores only |
