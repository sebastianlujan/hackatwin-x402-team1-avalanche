---
title: 'ADR 0007: Guarded viem clients for SDKs and anvil cheats'
---

# ADR 0007: Guarded viem clients for SDKs and anvil cheats

## Status

Accepted, 2026-11-04 (M5, T5.1, T5.3, T5.5).

## Context

The 43114 guard lives in `ChainClient.write` (T4.2). Demo 1 adds code that never goes through that port: the
`@x402/evm` facilitator and client signers take raw viem clients and pick their own actions, and the funding script
calls anvil cheats (`anvil_impersonateAccount`, `anvil_setBalance`). The fork keeps chain ID 43114
([Q20](../decisions.md#decision-log)), so a client pointed at the wrong RPC would write to, or sign for, mainnet.

## Decision

- `packages/chains` exports `createGuardedClients({ chain, rpcUrl })`. It probes once (chain ID, and
  `web3_clientVersion` for a loopback 43114 RPC), computes one refusal with `writeRefusal`, and builds every client it
  hands out on one guarded transport: `public`, `wallet(account)`, `chainClient(account?)`, and `cheats()`.
- When writes are refused, the transport passes only an explicit list of read methods (`eth_call`, `eth_getCode`,
  `eth_getLogs`, and similar). Every other method, including `eth_send*`, `anvil_*`, and `evm_*`, throws before the
  RPC is called. A method viem adds later is refused by default.
- Local accounts passed to `wallet()` refuse to sign when the target is refused, so no 43114 signature exists off a
  loopback anvil.
- `createChainClient` is rebuilt on the same factory, so the port and the SDKs share one guard.
- Dependency rule R9: only `packages/chains` source constructs viem clients (`createPublicClient`,
  `createWalletClient`, `createTestClient`). Test files are exempt.

Rejected: checks per viem action (the SDK chooses the action, and one missed action escapes); one wrapper per SDK
(one per integration, and they drift); feeding the SDKs our `ChainClient` port (they require viem clients).

## Consequences

- SDK integrations and scripts receive clients only from `packages/chains`; roots build them before registering.
- Cheats work only on a verified loopback anvil; reads keep working on public RPCs.
- Tests inject a scripted JSON-RPC node through the existing `transport` option.
- A new SDK integration needs no new guard code, only a client from the factory.
