# Proposal: Shared packages (M4)

## Intent

`packages/chains` and `packages/pricing` are empty: no registry, no `ChainClient` or `PriceOracle` adapter. M5 and M6 need one address source, a guarded viem client, and a live USD to ARGt price (Q12, Q16). Success: `pnpm quote` prints `1 USD = <x> ARGt (Curve, block N) | Chainlink <y> | Δ <z>% ✓` and `pnpm chains:verify` passes.

## Scope

### In Scope

- T4.1 to T4.7, every Done-when box.
- Prerequisites: block-pinned reads in the `ChainClient` port, an arg-aware `FakeChainClient`, a secret-free read-only RPC loader in config.

### Out of Scope

- Transactions, secrets, funded keys (C1, Q20). Mainnet RPCs are read-only.
- USDC quotes (M9), x402 `maxTimeoutSeconds` mapping (T5.4), the nightly trigger (T11.1), the Foundry scaffold (T7.1), Data Streams.

## Capabilities

### New Capabilities

- `chain-registry`: per-chain JSON, sources, checksums, optional L1, TS and forge readers.
- `chain-client`: viem adapter, read-only chains, 43114 anvil guard, keystores in roots only.
- `registry-verification`: `chains:verify` checks and exit codes.
- `price-oracles`: Curve, Chainlink, guarded decorator, freeze.
- `quote-cli`: `pnpm quote` line, normal and guarded.

### Modified Capabilities

- `core-domain-ports` (core-di): block-pinned reads, arg-aware fake.
- `config-profiles` (core-di): read-only RPC loader in `load-profile.ts` (R6), no API key or keystores.

## Approach and PR slicing

Stacked from `feature/core-config-guards`; PRs target `develop`; 400-line budget, no `size:exception`.

| PR | Branch | Approach | Est. |
|---|---|---|---|
| 1 | `feature/chain-port-reads` | Port delta, fake, read-only loader | 150 |
| 2 | `feature/chain-registry` | T4.1: six JSON files; only Verified facts. Arbitrum ARGt, USD₮0, the Base sequencer feed, and Fuji TeleporterRegistry are promoted with sources first; Chainlink entries re-checked on the official page | 350 |
| 3 | `feature/chain-client` | T4.2: viem pinned exact; Arbitrum and Base refuse writes; 43114 signing needs loopback plus anvil `web3_clientVersion`, checked at startup | 250 |
| 4 | `feature/chain-keystore` | T4.2: Web3 Secret Storage decrypt, roots only, public test vector | 200 |
| 5 | `feature/chain-registry-check` | T4.3: Step 0 code sizes and views; failure names chain and address; non-zero exit | 260 |
| 6 | `feature/curve-pool-oracle` | T4.4: `price_oracle()` at one block; asserts coins; USD₮0 as 1 USD; nightly Vitest project | 240 |
| 7 | `feature/chainlink-feed-oracle` | T4.5: proxy, runtime `decimals()`, 24 h staleness, `AggregatorV2V3Interface` sequencer read, `answer == 0`, 3600 s grace, no `answeredInRound`; inverts USD per ARS | 280 |
| 8 | `feature/guarded-oracle` | T4.6: inclusive 200 bps band in integers; else Chainlink, `guarded: true`; rate frozen 30 s; Q12 and demos.md say `maxTimeoutSeconds` | 230 |
| 9 | `feature/pnpm-quote` | T4.7: root reuses guarded readings; demos.md runbook | 170 |
| 10 | `feature/chain-registry-forge` | T4.1 `vm.parseJson` box, after T7.1 | 80 |

Pricing depends only on the port. PR tests use fakes; real RPCs run nightly only.

## Affected Areas

| Area | Impact |
|---|---|
| `packages/chains`, `packages/pricing` | New |
| `packages/core/src/ports/chain-client.ts`, `packages/core/src/testing/fake-chain-client.ts`, `packages/config/src/load-profile.ts` | Modified |
| `pnpm-workspace.yaml`, `vitest.config.ts`, `package.json` | Modified |
| `docs/decisions.md`, `docs/demos.md` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Chainlink tracks the official rate (≈1570), Curve the CCL rate (≈1658): Δ ≈ 5.6%, guard always trips | High | Read live in PR 7; decide before PR 8 |
| Public RPC rate limits | Med | Batched reads, retries, freeze |
| Thin Curve pool (≈$29.6k) | Med | EMA oracle, band, flag |
| Sequencer feed down or `startedAt == 0` | Low | Reject, grace |
| viem under TypeScript 7 | Med | Typecheck in PR 3 first |
| T7.1 not merged | Med | PR 10 waits |

## Rollback Plan

One squash commit per PR; revert newest first. Nothing consumes chains or pricing before M5; the port delta ships with its only implementer.

## Dependencies

- PR #42; T7.1 for PR 10.
- Decisions: Q11, Q12, Q16, Q17, Q20, Q21, C1, C6.

## Success Criteria

- [ ] `pnpm quote` prints the documented line live; the guarded line is unit-tested.
- [ ] `chains:verify` exits 0 live, non-zero naming chain and address.
- [ ] Registry holds only verified, checksummed, sourced addresses.
- [ ] 43114 writes refused without anvil; Arbitrum and Base never write.
- [ ] Tests cover both 2% edges, stale round, sequencer down, grace, wrong coins.
- [ ] PR CI calls no real RPC; every PR stays under 400 lines.

## Proposal question round (pending user review, not asked: auto mode)

1. Guard basis (Q12, Q16): if Chainlink is official-rate, keep ±2% (always Chainlink), add a CCL premium, or widen the band? Assumed: verify first, no silent Q12 change.
2. Guarded line: assumed `1 USD = <y> ARGt (Chainlink, guarded) | Curve <x> (block N) | Δ <z>% ⚠`.
3. Promote the four unverified addresses (assumed) or assert Curve coins by `symbol()` only?
4. Forge box: wait for T7.1 (assumed) or pull a Foundry harness into M4?
5. Freeze: one rate per asset for 30 s (assumed) or per price and asset?

## Resolved by the orchestrator (2026-11-04, live read-only reads)

- Risk 1 is not real: Curve `price_oracle()` = 1658.36 ARGt per USD₮0 and Chainlink Base "ARS / USD" (8 decimals) = 0.00060317, that is 1657.92 ARS per USD. Delta 0.03%, inside the ±2% band; the Base feed tracks the market rate, not the official one. Q12 and the ±2% band stand.
- Curve pool coins: `coins(0)` = ARGt `0x59863989d080B22476DB95656d0C3CC18be92214`, `coins(1)` = USD₮0 `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` (6 decimals), both read on Arbitrum. Promote them with these reads as the source.
- Question round defaults (user asleep, auto mode): output line exactly as in demos.md; promote the four addresses with sources; defer the forge `vm.parseJson` box to T7.1 (no Foundry in M4); one frozen rate per asset; USD₮0 counts as 1 USD.
