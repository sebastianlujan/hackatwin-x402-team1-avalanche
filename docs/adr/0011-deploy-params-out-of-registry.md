---
title: 'ADR 0011: Deploy params stay out of the registry'
---

# ADR 0011: Deploy params stay out of the registry

## Status

Accepted, 2026-11-04 (M7, T7.10).

## Context

The deploy scripts need chain facts (router, USDC, transferrers, blockchain IDs, selectors) and deployment choices
(deployer, owner, gas limits, fallback recipient, allowlists, the receiver deployer and its nonce). The registry holds
verified facts only (T4.1), and a wallet or a tuning value is not a verified fact.

## Decision

- Scripts read facts only through the forge registry reader, selected by `block.chainid`. The registry gains optional
  `icm.blockchainId`, `icm.usdcTokenHome` and `icm.usdcTokenRemote`, filled when the L1 and its ICTT pair exist (M6).
- Scripts read every choice from `packages/contracts/script/params/<chainKey>.json`. A missing fact reverts
  `Registry_EntryNotFound`, a missing parameter reverts `Deploy_ParamNotFound`, both before any transaction.
- `CHAIN_REGISTRY_DIR`, `DEPLOY_PARAMS_DIR` and `DEPLOY_DEPLOYMENTS_DIR` select directories, so dry-runs use fixtures
  under `test/fixtures` and never touch `packages/chains`.

Rejected: wallets and gas limits in the registry (not verifiable facts); Solidity constants (the no-literal rule).

## Consequences

- Params files hold no secrets: signers come from keystores (`--account`), never from a file or the environment.
- Real params arrive with the testnet deploy (T7.12); until then a missing entry fails loudly.
