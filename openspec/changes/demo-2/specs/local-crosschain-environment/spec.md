# Local Crosschain Environment Specification

## Purpose

Two plain anvils that host a complete Demo 2 world (infra plus our contracts), built by the real deploy scripts, with ICM sources fetched at the pinned commit and never committed. Development and tests only. Registry JSON under `packages/chains` is untouched.

## Requirements

### Requirement: Two plain anvils with distinct local chain IDs

The setup MUST start two anvils without forking, with `--hardfork cancun` and two distinct chain IDs. Neither ID MAY be 43113, 43114, or 11155111. Both RPC URLs MUST be loopback.

#### Scenario: Chain IDs
- GIVEN the setup has started
- WHEN each anvil reports its chain ID
- THEN the IDs differ from each other and from 43113, 43114, and 11155111

#### Scenario: Forbidden ID
- GIVEN a profile static chain ID of 43113
- WHEN the setup starts
- THEN it fails naming the ID before any anvil starts

### Requirement: Pinned ICM fetch, never committed

A script MUST fetch `ava-labs/icm-services` at commit `34deb30f7ddb4e6fecfd1132b413d09570610851` into `.cache/icm-services/<commit>/` at the repo root, build it with its own foundry config, and reuse a cached clone for the same commit. `.cache/` MUST be gitignored. No tracked file MAY carry an SPDX header (`SPDX-License-Identifier:`) whose value is `LicenseRef-Ecosystem`, and no foundry project of ours MAY import the clone. A check MUST fail if a tracked file carries that header. The check matches only the SPDX header form, not the bare token (project docs mention it).

#### Scenario: Cache hit
- GIVEN `.cache/icm-services/<commit>/` is built
- WHEN the script runs again
- THEN no network fetch happens

#### Scenario: License guard
- GIVEN a tracked file whose SPDX header (`SPDX-License-Identifier:`) value is `LicenseRef-Ecosystem`
- WHEN the license check runs
- THEN it fails naming the file

#### Scenario: Bare token allowed
- GIVEN a tracked doc that mentions `LicenseRef-Ecosystem` without the SPDX header
- WHEN the license check runs
- THEN it passes

#### Scenario: Clean tree
- GIVEN a full setup and teardown
- WHEN the working tree is inspected
- THEN no tracked file changed and no untracked file lies outside gitignored paths

### Requirement: Infra deployed on both chains

The setup MUST place the Warp stub at the Warp address `0x0200000000000000000000000000000000000005` on both chains and deploy: a 6-decimal test USDC, `CCIPLocalSimulator` on the hub chain, Teleporter at `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` on both chains, `TeleporterRegistry`, and the ICTT home (hub) and remote (L1). It MUST relay `registerWithHome`. If anvil cannot accept the keyless Teleporter deploy, an equivalent placement MUST still yield the canonical address with working constructor storage.

#### Scenario: Teleporter address
- GIVEN the infra deploy finished
- WHEN code is read at the canonical Teleporter address on each chain
- THEN it is non-empty on both

#### Scenario: Round trip
- GIVEN the infra deploy finished
- WHEN a test message is sent from the hub Teleporter and relayed
- THEN the L1 Teleporter marks it received

#### Scenario: Remote registered
- GIVEN the ICTT pair is deployed
- WHEN `registerWithHome` has been relayed
- THEN the home lists the remote as registered

### Requirement: Local registry and params in gitignored dirs

The setup MUST write a local registry, params, and deployments into gitignored directories and point the scripts to them through `CHAIN_REGISTRY_DIR`, `DEPLOY_PARAMS_DIR`, and `DEPLOY_DEPLOYMENTS_DIR`. It MUST be readable through `fs_permissions` by a single added entry. The hub entry MAY use the key `fuji` and the L1 entry `twinpay-l1` (the scripts hardcode them); the source side MUST use the key `local-ccip`. The real registry files MUST stay identical.

#### Scenario: Registry untouched
- GIVEN a full setup
- WHEN `packages/chains` registry JSON is diffed against the base
- THEN it is identical

#### Scenario: Source key
- GIVEN the local registry
- WHEN the source chain key is read
- THEN it is `local-ccip` with a selector

### Requirement: Real scripts, unlocked sender

`DeployFuji` and `DeployL1` MUST run unchanged against the local world with `--unlocked --sender <deployer>` and MUST NOT receive `--private-key`. The receiver deployer MUST be a fresh account at nonce 0 matching the params nonce (ADR 0010, ADR 0011).

#### Scenario: Both scripts succeed
- GIVEN the infra deploy finished
- WHEN both scripts run
- THEN contract code exists at each recorded address and the messenger's receiver equals the L1 receiver

#### Scenario: No private key
- GIVEN the setup source and CI workflows
- WHEN searched for `--private-key`
- THEN there are no matches

#### Scenario: Script diff
- GIVEN the change
- WHEN `packages/contracts/src` and `script` are diffed
- THEN they are unchanged

## Assumptions

Local serves CLI dev runs and E2E through one dev-only module. The fetch before O7 sign-off is accepted for dev and CI. A real local Avalanche network (S8) is out of scope.

## Traceability

| Done-when box | Requirement |
|---|---|
| T8.5 contracts deployed by the real scripts | Real scripts, unlocked sender; Local registry and params |
| Success: no secrets, RPCs, or funds | Two plain anvils |
| Success: no tracked icm-services source, clean `git status` | Pinned ICM fetch, never committed |
| Proposal: Teleporter and ICTT on bare anvil | Infra deployed on both chains |
