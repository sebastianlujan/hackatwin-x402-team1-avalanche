# Verify report: shared-packages (M4)

Verdict: PASS WITH WARNINGS (0 CRITICAL, 1 WARNING, 2 SUGGESTION). PR 10 DEFERRED to T7.1.
Verified against the stack tip `origin/feature/pnpm-quote` (`9232ff7`). Mode: standard (Q21, no strict TDD).

## Runtime evidence

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm typecheck` | pass (chains, pricing, docs, all workspaces) |
| `pnpm test` | 19 files, 200 tests passed; coverage 98.2% stmts, 94.19% branches, 98.94% lines |
| `pnpm exec biome check .` | 127 files, no issues |
| `pnpm quote` (live) | `1 USD = 1658.4 ARGt (Curve, block 521124406) \| Chainlink 1657.9 \| Δ 0.03% ✓`, exit 0 |
| `pnpm chains:verify` (live) | 22 PASS, 1 SKIP (twinpay-l1 planned), exit 0 |
| CI PRs #46, #48, #50, #52, #54, #56, #58, #60, #62 | each 10/10 SUCCESS (`gh pr view --json statusCheckRollup`) |

## Spec compliance (requirement and scenario, test names from the verbose run)

chain-client
- Adapter implements port / Pinned read: PASS (`chain-client.test.ts` "pins an explicit block and returns it", "pins an unpinned read to the head").
- Read-only mainnets / Write on Base: PASS ("refuses a write on base and sends nothing", arbitrum too; `write-guard.test.ts`).
- 43114 anvil guard, three scenarios: PASS ("public 43114 RPC without probing", "loopback not anvil", "loopback anvil allowed"; `write-guard.test.ts`).
- Keystores in roots only / public vector and wrong password: PASS (`keystore.test.ts` pbkdf2 and scrypt vectors, wrong password message omits password).
- Keystores / Import boundary: PASS (`test/dependency-rule.test.ts` R7).

chain-registry
- Six chains load, unknown key: PASS (`registry.test.ts` "loads six chains...", "names an unknown key").
- Checksum, source, Verified facts, unverified rejected: PASS ("has a source on every entry", "has every registry address in Verified facts and rejects one that is not", "rejects a bad checksum").
- Promoted entries: PASS (live `chains:verify` passes all four; decisions.md rows per apply-progress).
- Optional L1: PASS (`parseChain` "rejects contracts on a planned chain"; registry types `chainId?`, `rpc?` undefined; `chains:verify` SKIP). NOTE: the "lookups return undefined" wording is covered through optional fields, not a dedicated lookup assertion.
- Forge reader: DEFERRED (PR 10 / task 10.1, tracked, box stays open as the spec requires). No Foundry harness added (spec-compliant).

config-profiles
- loadRpcUrls four scenarios: PASS (`load-profile.test.ts` "needs no secrets", "env override ... empty is unset", "names the variable when neither value nor default", "names the variable, never the value").
- Sole environment reader / Env coverage: PASS (`env-example.test.ts`; `process.env` only in `load-profile.ts` lines 27 and 52, rule R6 in `test/dependency-rule.ts:147`).

core-domain-ports
- Block-pinned reads, seven ports: PASS (`core/src/ports/chain-client.ts` lines 19-34; `ports.test.ts` "reads at the head or at a pinned block").
- Arg-aware FakeChainClient: PASS (`fakes.test.ts` "separates the same function with different args", "unscripted call naming address, function and args", "records the requested block").

price-oracles
- Curve: PASS (happy read, wrong coins(0) and coins(1)).
- Chainlink: PASS (fresh, runtime decimals, stale at 24 h boundary, sequencer down, 3599 rejected / 3600 accepted, startedAt 0, zero/negative).
- Guarded band: PASS (+2%, -2%, one unit beyond each side, integer inclusive).
- Frozen quote: PASS (29 s reuse, 30 s re-read, plus in-flight sharing and no caching of rejects).
- Nightly integration: PASS (`pnpm test` runs `--project default`; nightly project holds the real-RPC tests, run live by PR 6 and PR 7 evidence).

quote-cli
- Normal line: PASS (live output matches the format; `quote-line.test.ts`). Spec example prints 1658.3; implementation rounds half-up so a Curve 1658.36 prints 1658.4 (see deviation D9).
- Guarded line: PASS (`quote-line.test.ts` "prints the guarded line").
- No duplicated logic / Failure: PASS (`quote.test.ts` "reuses the shared guarded oracle", "holds no band arithmetic"; "prints the error and returns a non-zero code").
- Runbook updated: PASS WITH NOTE (`docs/demos.md:36` maxTimeoutSeconds, `:61` pnpm quote; decisions.md Q12 carries `maxTimeoutSeconds: 30`). The `pnpm quote` entry has no script note; other unbuilt scripts keep theirs (legend line 9), so the spec's "no script-to-be-added note" holds for quote only.

registry-verification
- Step 0 checks, skip, failures naming chain and address, one-of-many, RPC down: PASS (`verify-registry.test.ts`, 8 tests; live run exit 0; apply-progress records live unreachable-Base FAIL exit 1 without URL).

## Deviations judged

| # | Deviation | Judgment |
|---|---|---|
| D1 | Task 3.1 (viem pin) moved into PR 2 | Acceptable; viem needed by `toViemChain`; no spec impact. |
| D2 | Keystore scrypt vector uses Foundry-generated N=8192 (OpenSSL rejects published N) | Acceptable with caveat; scenario says "public vector" and the key is the public one; published-params path asserted as KeystoreError. WARNING W1. |
| D3 | env coverage test moved to `env-example.test.ts`; `# default:` comments | Acceptable, matches SD3. |
| D4 | `verify.nightly.test.ts` stub deferred to PR 6 | Acceptable, task allowed it. |
| D5 | ERC-8004 split into two entries; ARGt is BeaconProxy; Teleporter registry address | Acceptable, all live-verified by `chains:verify`. |
| D6 | `ChainsClient` adds `codeSize`; port unchanged | Acceptable, no port-spec change. |
| D7 | `pnpm test` limited to `--project default`; nightly tests in `pricing/nightly/`; R6/R7 fixtures moved | Acceptable, implements Nightly integration and R8. |
| D8 | decisions.md reference-rates row corrected | Acceptable (sourced live read). |
| D9 | deltaBps absolute and half-up; quote rate floored, amount ceil may exceed ideal by 1 wei; validUntil fixed at request time; quote rounds half-up (1658.4) | Acceptable; band test is exact integer inequality per spec; rounding is display only. SUGGESTION S1: align spec example (1658.3) with half-up. |
| D10 | demos.md acceptance rg cannot be empty for whole file | Acceptable; note dropped for `pnpm quote` only. |
| D11 | TS 5.x fallback not used | Acceptable, typecheck green on TS 7. |

## Tasks
Tasks 1.1 to 9.3 are marked complete and match code state on the stack tip. 10.1 open by design (DEFERRED).

## Findings
- CRITICAL: none.
- WARNING W1: the "public Web3 Secret Storage test vector" scenario for scrypt is met with a Foundry-generated vector rather than the published parameters (OpenSSL limitation). Record a design note if a later task needs the published vector.
- SUGGESTION S1: update the quote-cli spec example to 1658.4 (half-up) to remove the visible mismatch.
- SUGGESTION S2: add a dedicated assertion that an undeployed `twinpay-l1` lookup returns undefined (currently covered via optional fields and `chains:verify` SKIP).

next_recommended: sdd-archive after PR 10 is tracked under T7.1 (or archive with the forge box open, as the spec permits).
