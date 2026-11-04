# Delta for Contracts Deployment (demo-2)

Base: `contracts` change `contracts-deployment` (not yet archived). Scripts and contracts are unchanged; only the signing rule gains a loopback exception.

## MODIFIED Requirements

### Requirement: Dry-run by default, keystores only

Without `--broadcast` a script MUST send nothing and write no file. The signer MUST be bound to the params deployer address with `vm.startBroadcast(deployer)` and sign through `--account <keystore>`, except against a loopback anvil of the local world, where `--unlocked --sender <deployer>` MAY be used. Scripts MUST NOT read a private key from the environment or accept one as an argument. No workflow or script under `script/**` or `.github/workflows/**` MUST pass `--broadcast` in this change; the dev-only local world MAY broadcast to its own anvils.
(Previously: `--account <keystore>` was the only signing path and nothing anywhere broadcast.)

#### Scenario: Dry-run writes nothing
- GIVEN a dry-run
- WHEN it finishes
- THEN no transaction was broadcast and `packages/chains/deployments/` is unchanged

#### Scenario: No raw keys
- GIVEN `script/**` and `.github/workflows/**`
- WHEN searched for `PRIVATE_KEY`, `--private-key`, and `--broadcast`
- THEN there are no matches

#### Scenario: Local unlocked sender
- GIVEN the local world on loopback anvils
- WHEN the real script runs with `--unlocked --sender <deployer>`
- THEN it deploys and no private key is passed

#### Scenario: Unlocked on a remote host
- GIVEN a non-loopback RPC
- WHEN the local setup is asked to deploy with `--unlocked`
- THEN it refuses before any transaction

## Traceability

| Done-when box | Requirement |
|---|---|
| T8.5 contracts deployed by the real scripts | Dry-run by default, keystores only (loopback exception) |
| Proposal: `--unlocked --sender`, never `--private-key` | Dry-run by default, keystores only |
