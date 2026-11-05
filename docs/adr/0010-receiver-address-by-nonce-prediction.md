---
title: 'ADR 0010: Receiver address by nonce prediction'
---

# ADR 0010: Receiver address by nonce prediction

## Status

Accepted, 2026-11-04 (M7, T7.6 and T7.7).

## Context

`IcttMessenger` (Fuji) must know the `SettlementReceiver` address as `recipientContract`, and the receiver (L1) must know
the messenger as its only valid origin sender. Both are immutable, so one must be deployed knowing the other's address.

## Decision

- The messenger is deployed first. Its receiver address is `computeCreateAddress(receiverDeployer, nonce)`, with the
  deployer and nonce read from the deploy params.
- The L1 script asserts the deployer nonce equals the predicted one before broadcasting and asserts the deployed address
  after.
- A burned nonce means a new messenger, because nothing is mutable.
- Contracts are constructed with the deployer as owner and ownership is offered to the params owner afterwards. The
  offer is a transaction after the receiver deployment, so the receiver deployer nonce prediction is unchanged.

Rejected: a set-once receiver field on the messenger (mutable trust in a window after deployment); CREATE3 (needs a
factory contract on each chain).

## Consequences

- No privileged setter exists; both sides are fixed at deployment.
- The deploy scripts own the nonce check, so a skipped transaction on the L1 deployer fails loudly.
