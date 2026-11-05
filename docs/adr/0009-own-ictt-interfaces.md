---
title: 'ADR 0009: Own minimal ICTT interfaces'
---

# ADR 0009: Own minimal ICTT interfaces

## Status

Accepted, 2026-11-04 (M7, T7.2). The human sign-off O7 is still open.

## Context

Our contracts call two ICTT surfaces: `receiveTokens` on the receiver and `sendAndCall` on the token transferrer, with
the `SendAndCallInput` struct. `ava-labs/icm-services` has no npm package and ships under the Ecosystem License 1.1,
which does not fit a MIT repo without sign-off ([O7](../PLAN.md)).

## Decision

- `src/interfaces/external/icm/` holds three declarations only: `IERC20SendAndCallReceiver`, an
  `IERC20TokenTransferrer` with only `sendAndCall`, and the file-level `SendAndCallInput`. They are original MIT
  files written from the documented ABI. No upstream source or license file is copied.
- `PROVENANCE.md` records the upstream repository and commit used as the ABI reference.
- `test/unit/IcmInterfaces.t.sol` pins the literal selectors and the struct tuple string, so any drift from the ABI
  fails the build. A Vitest case checks the directory contents and the provenance note.
- O7 stays a human decision. If it is refused, the fallback is to vendor the upstream files with the Ecosystem License
  copied unmodified (the original T7.2).

Rejected: vendoring now (license unresolved); a git submodule or `forge install` (the standards forbid both).

## Consequences

- No license risk from copied code, at the cost of a pin test that must follow upstream ABI changes.
- Fork tests against the real ICTT bytecode (after M6) are the check that our interfaces match the deployed contracts.
