---
title: 'ADR 0006: Block-pinned chain reads'
---

# ADR 0006: Block-pinned chain reads

## Status

Accepted, 2026-11-04 (M4, T4.2).

## Context

The price oracles combine several reads into one rate and must say which block it came from. A bare `read` returns only
the value, so each caller would track blocks on its own, and two reads of one quote could land on different blocks.
The registry check has the same need: all entries of a chain are read at one block.

## Decision

- `ChainClient.read(call, { blockNumber? })` returns `{ value, blockNumber }`, and a new `blockNumber()` returns the
  head.
- The viem adapter pins an unpinned read to the head it just fetched, so the result always names its block.
- `FakeChainClient` scripts reads by `address:functionName(args)`, records each requested block, and rejects with the
  address, function and args when a read is not scripted.
- The port changes together with its only implementers (the fake), so no consumer breaks.

Rejected: tracking blocks inside each oracle (duplicated, and unpinned reads can straddle a block); a separate
`readAt` method (two ways to read, and callers must pick).

## Consequences

- Callers read `result.value` and can assert `result.blockNumber` is the same across one quote.
- Core stays free of viem: block numbers are `bigint` in the port.
- Tests that script reads use the `address:fn(args)` key, so a function called with different args needs one entry
  per args.
