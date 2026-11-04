# Tasks: Shared packages (M4)

Source: `proposal.md`, `design.md` (D1 to D14, SD1 to SD3, Scenario Coverage), `specs/*/spec.md`, `docs/PLAN.md` T4.1 to T4.7.

## Review Workload Forecast

| Field | Value |
|---|---|
| Review budget | 400 authored lines per PR (additions plus deletions; `pnpm-lock.yaml` excluded) |
| Total forecast | about 2,030 authored lines over 9 PRs (PR 10 deferred, about 80 more) |
| Chained PRs recommended | Yes |
| Chain strategy | Stacked PRs; PR 1 branches from `feature/modules-diagram-roots` (PR #44); each next PR branches from the previous one; every PR targets `develop` |
| Size exception | None; anything over budget is split, never `size:exception` |
| 400-line budget risk | Medium (PR 2 at 350 and PR 7 at 280 are the tight ones) |
| Decision needed before apply | No (split rule is pre-decided: see "Split triggers") |

| PR | Branch | Tasks | Forecast lines | Risk |
|---|---|---|---|---|
| 1 | `feature/chain-port-reads` | 1.1 to 1.4 | 150 | Low |
| 2 | `feature/chain-registry` | 2.1 to 2.4 | 350 | High (near budget) |
| 3 | `feature/chain-client` | 3.1 to 3.3 | 250 | Medium |
| 4 | `feature/chain-keystore` | 4.1 to 4.2 | 200 | Low |
| 5 | `feature/chain-registry-check` | 5.1 to 5.2 | 260 | Medium |
| 6 | `feature/curve-pool-oracle` | 6.1 to 6.3 | 240 | Medium |
| 7 | `feature/chainlink-feed-oracle` | 7.1 to 7.2 | 280 | Medium |
| 8 | `feature/guarded-oracle` | 8.1 to 8.3 | 230 | Medium |
| 9 | `feature/pnpm-quote` | 9.1 to 9.3 | 170 | Low |
| 10 (deferred) | `feature/chain-registry-forge` | 10.1 | 80 | Low |

### Split triggers (apply without asking)

- PR 2: if the six JSON files plus `registry.ts` plus tests exceed 400 authored lines, split into 2a (`registry.ts`, schema, `cchain`, `fuji`, `sepolia`, `twinpay-l1`, tests) and 2b (`arbitrum`, `base`, the four `decisions.md` promotions, remaining tests). Branch 2b from 2a; renumber nothing else.
- PR 7, PR 5: if over 400, split the test file into a follow-up PR is NOT allowed (tests stay with code); split by oracle concern instead (7a decimals and staleness, 7b sequencer and grace).
- Any PR: measure with `git diff --stat develop...HEAD` excluding `pnpm-lock.yaml` before opening.

### Conventions for every task

- Each source file ships with its `*.test.ts` in the same commit (work-unit commits; one squash commit per PR).
- TS tests required; strict TDD applies only to Solidity (Q21), so write tests alongside code, not necessarily first.
- Pins: viem `2.57.16` exact (verified), vitest `5.1.0`, zod `4.6.7`, TypeScript `7.0.2`. Fallback: if viem fails to typecheck on TS 7.0.2 in task 3.1, pin TS 5.x for `chains` and `pricing` only, and record it in the PR body and a one-line note in `docs/adr/0005`.
- Real-RPC tests are `*.nightly.test.ts` in a `nightly` Vitest project; `pnpm test` never calls an RPC.
- Registry key for C-Chain is `cchain` (`cchain.json`); the env variable is `CCHAIN_RPC_URL`.
- Each PR body: Chain Context diagram with the current PR marked, start state, end state, out of scope, focused test command and exact result, rollback boundary.
- English, no AI attribution, conventional commits, code comments one line or none.

## PR 1: Port delta, fake, RPC loader (`feature/chain-port-reads`, about 150 lines)

Start state: `ChainClient.read(call)` returns a bare value; fake is name-keyed; no RPC loader.
End state: block-pinned port, arg-aware fake, secret-free loader, ADR 0006.
Rollback: revert the squash commit; nothing else consumes the port yet.

- [ ] 1.1 Port delta (D1). Update `packages/core/src/ports/chain-client.ts`: `ReadOptions`, `ReadResult<T>`, `blockNumber()`, `read` returns `{ value, blockNumber }`. Add compile checks to `packages/core/src/ports/ports.test.ts`. About 35 lines.
  - Satisfies: core-domain-ports "Pinned read", "Unpinned read", "Seven ports / Pinned read in the port".
  - Acceptance: `pnpm --filter @hackatwin/core test` passes `ports.test.ts`; `pnpm typecheck` clean.
- [ ] 1.2 Arg-aware fake (D2). Update `packages/core/src/testing/fake-chain-client.ts`: scripts keyed `address:fn(args)`, bigint-safe; `Error` values reject; `calls` records requested block; misses name address, function, args. Add `packages/core/src/testing/fakes.test.ts` cases. About 55 lines.
  - Satisfies: core-domain-ports "Scripted fake", "Same function, different args", "Unscripted call", "Requested block recorded", "Fake in production code".
  - Acceptance: `fakes.test.ts` covers each named scenario; dependency-rule test still passes.
- [ ] 1.3 RPC loader (D4, SD2, SD3). Add `loadRpcUrls(needed, env = process.env)` to `packages/config/src/load-profile.ts`; add comment-line-above-each-RPC-variable to `.env.example` (value empty, comment holds registry default); add `packages/config/src/env-example.test.ts`; add `load-profile.test.ts` cases. About 45 lines.
  - Satisfies: config-profiles "No secrets needed" (passes with empty env, SD2), "Env overrides default", "Missing RPC" (`TWINPAY_L1_RPC_URL` named, SD2), "Invalid URL" (variable named, never value), "Env coverage" (SD3), "Single reader".
  - Acceptance: `pnpm --filter @hackatwin/config test` passes; `test/dependency-rule.test.ts` shows `process.env` only in `load-profile.ts`.
- [ ] 1.4 ADR and README row. Add `docs/adr/0006-block-pinned-chain-reads.md` and its README table row. About 40 lines.
  - Satisfies: design D1 (ADR 0006).
  - Acceptance: README row links the file; markdown lint (if configured) passes.

Depends on: none inside M4 (stacks on PR #44 branch). Parallel: 1.1 to 1.4 are independent files, but 1.2 needs 1.1; commit in order 1.1, 1.2, 1.3, 1.4.

## PR 2: Chain registry (`feature/chain-registry`, about 350 lines, T4.1)

Start state: `packages/chains` empty.
End state: six validated JSON files, typed lookups, four addresses promoted with sources.
Rollback: revert; remove `packages/chains/registry`, `registry.ts`, and the four `decisions.md` rows.
Depends on: PR 1.

- [ ] 2.1 Promote four addresses in `docs/decisions.md` Verified facts (Arbitrum ARGt, USD₮0, Base sequencer feed, Fuji TeleporterRegistry) with source and date; re-check the Chainlink entries on the official page and cite it. Orchestrator-verified values: ARGt `0x59863989d080B22476DB95656d0C3CC18be92214`, USD₮0 `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`, ARS/USD feed `0xaf992a6ad37b4878cF9c31f082B178860e268cE3`, sequencer `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433`. About 30 lines.
  - Satisfies: chain-registry "Promoted entries", "Unverified address rejected".
  - Acceptance: every registry address has a row in Verified facts; TeleporterRegistry re-read on Fuji before promotion (read-only).
- [ ] 2.2 Registry schema and loader (D3). `packages/chains/src/registry.ts` with zod 4.6.7 schema, `listChains()`, `chain(key)` (throws `ChainError` naming the key), `toViemChain(key)` (throws for planned L1), EIP-55 checksum validation, `source` rule (`https://` or `read: `). `packages/chains/package.json`, `tsconfig`, vitest wiring. About 120 lines.
  - Satisfies: chain-registry "Six chains load" (SD1), "Unknown chain", "Checksum enforced", "L1 not deployed".
  - Acceptance: `chains/src/registry.test.ts` covers six entries (five with chain ID and viem chain; L1 has neither and `toViemChain('twinpay-l1')` throws naming the key), unknown key, bad checksum, missing source, L1 lookups return `undefined`.
- [ ] 2.3 Six JSON files: `cchain` (43114, `fork-only`), `fuji`, `sepolia` (with `ccip.chainSelector` string), `twinpay-l1` (`planned`, `contracts: {}`), `arbitrum`, `base` (`arsUsdFeed.heartbeatSeconds: 86400`), with `checks` per design. About 150 lines.
  - Satisfies: chain-registry "Six chains load", "Promoted entries", "Unverified address rejected"; price-oracles heartbeat source.
  - Acceptance: `registry.test.ts` scans `docs/decisions.md` Verified facts and fails on any registry address absent from it; heartbeat 86400 test passes.
- [ ] 2.4 Docs/exports. Package `index.ts` export of registry API. About 20 lines.
  - Acceptance: `pnpm typecheck` clean.

Parallel: 2.1 first (data), then 2.2 and 2.3 can proceed together; 2.4 last.

## PR 3: Viem chain client with write guard (`feature/chain-client`, about 250 lines, T4.2 part 1)

Start state: registry exists; no adapter.
End state: `createChainClient` asserting chain ID and enforcing write policy.
Rollback: revert; remove `chain-client.ts`, `write-guard.ts`, viem catalog entry.
Depends on: PR 2.

- [ ] 3.1 Add viem `2.57.16` exact to the `pnpm-workspace.yaml` catalog and `chains` package. Typecheck on TypeScript 7.0.2 first; on failure apply the TS 5.x fallback for `chains` and `pricing` and record it. About 10 lines plus lockfile (excluded).
  - Satisfies: design D13.
  - Acceptance: `pnpm typecheck` result recorded in PR body (TS 7 pass or fallback note).
- [ ] 3.2 Write policy (D5). `packages/chains/src/write-guard.ts`: `read-only` access and IDs 42161, 8453 never write; 43114 writes only via `CCHAIN_FORK_RPC_URL` that is loopback and reports `anvil` in `web3_clientVersion`; `CCHAIN_RPC_URL` stays read-only. About 90 lines with `write-guard.test.ts`.
  - Satisfies: chain-client "Write on Base", "Public RPC", "Loopback not anvil", "Local anvil", "Read-only mainnets", "43114 anvil guard".
  - Acceptance: `write-guard.test.ts` covers all four named scenarios.
- [ ] 3.3 Adapter (D1, D5, D13). `packages/chains/src/chain-client.ts`: async `createChainClient({ chain, rpcUrl, account? })`, asserts `eth_chainId`, `http(url, { batch: true, retryCount: 3 })`, unpinned reads pinned to head, returns `{ value, blockNumber }`. About 150 lines with `chain-client.test.ts` using `custom()` transport.
  - Satisfies: chain-client "Adapter implements the port / Pinned read", "Write on Base" (transport sees no send), "Local anvil".
  - Acceptance: `chain-client.test.ts` passes; `custom()` transport records zero `eth_sendRawTransaction` on refused writes; chain-ID mismatch rejects.

Parallel: 3.2 and 3.3 independent in code but 3.3 imports 3.2; sequential 3.1, 3.2, 3.3.

## PR 4: Keystore (`feature/chain-keystore`, about 200 lines, T4.2 part 2)

Start state: client exists, no signer.
End state: Web3 Secret Storage v3 decrypt in a subpath, banned inside `packages/*` by R7.
Rollback: revert; remove `chains/src/keystore/` and R7.
Depends on: PR 3.

- [ ] 4.1 Keystore (D6). `packages/chains/src/keystore/` (scrypt, pbkdf2, AES-128-CTR on `node:crypto`, viem `keccak256` MAC, `timingSafeEqual`), `loadKeystoreAccount(name, passwordFile)` exported at `@hackatwin/chains/keystore` (package `exports` subpath). About 150 lines with `keystore.test.ts`.
  - Satisfies: chain-client "Public test vector", "Keystores decrypted in roots only".
  - Acceptance: public Web3 Secret Storage test vectors (scrypt and pbkdf2) decrypt to the known key; wrong password throws `KeystoreError` naming the keystore and not the password.
- [ ] 4.2 Rule R7. Add R7 to `test/dependency-rule.ts` (no import of `@hackatwin/chains/keystore` under `packages/*`) and cases to `test/dependency-rule.test.ts`. About 50 lines.
  - Satisfies: chain-client "Import boundary".
  - Acceptance: a fixture importing the subpath from `packages/*` fails; a root script import passes.

Sequential: 4.1 then 4.2.

## PR 5: On-chain registry check (`feature/chain-registry-check`, about 260 lines, T4.3)

Start state: registry and client exist.
End state: `pnpm chains:verify` runs secret-free with zero config.
Rollback: revert; remove `verify-registry.ts`, `scripts/verify.ts`, root script.
Depends on: PR 3 (4 not required; may land in order).

- [ ] 5.1 `verifyRegistry(chains, connect)` in `packages/chains/src/verify-registry.ts` (D3 section): one block per live chain, adapter-only `codeSize`, `checks` with `@name` and string `args`/`expect`; failures print `FAIL <chain> <name> <address>`, planned L1 prints `SKIP`; never prints RPC URL; exit code 1 after all entries. About 170 lines with `verify-registry.test.ts`.
  - Satisfies: registry-verification "All healthy", "Optional L1 skipped", "Missing contract", "One of many fails", "RPC down".
  - Acceptance: `verify-registry.test.ts` covers the five scenarios with fakes, including a rejected `connect`, `blockNumber`, and `read` marking every affected entry.
- [ ] 5.2 Root `packages/chains/scripts/verify.ts` wiring `loadRpcUrls` and `createChainClient`; root `package.json` script `chains:verify`. About 60 lines plus a nightly `verify.nightly.test.ts` stub excluded from `pnpm test` (project defined in PR 6; stub added there if absent).
  - Satisfies: T4.3 Done-when (Step 0 repeated, non-zero exit).
  - Acceptance: `pnpm chains:verify` live exits 0 and prints no RPC URL (manual, recorded in PR body); source scan shows no `process.env` outside config.

Sequential: 5.1 then 5.2.

## PR 6: Curve pool oracle and nightly project (`feature/curve-pool-oracle`, about 240 lines, T4.4)

Start state: no pricing code.
End state: `CurvePoolOracle` on the port only; nightly Vitest project; rule R8.
Rollback: revert; remove `curve-pool-oracle.ts`, Vitest projects, R8.
Depends on: PR 3 (port and registry types); may be built before PR 5 is merged but stacks after it.

- [ ] 6.1 Vitest projects (D14): `nightly` project for `*.nightly.test.ts`, default project excludes them. Edit root `vitest.config.ts`. About 30 lines.
  - Satisfies: price-oracles "PR CI".
  - Acceptance: `pnpm test` runs zero `*.nightly.test.ts`; `pnpm vitest --project nightly --run` selects them.
- [ ] 6.2 Rule R8 in `test/dependency-rule.ts` and test: `pricing/src` imports only core. About 40 lines.
  - Acceptance: fixture importing `@hackatwin/chains` from `pricing/src` fails.
- [ ] 6.3 `CurvePoolOracle` (D7, D8). `packages/pricing/src/curve-pool-oracle.ts`: one block, `coins(0)` equals registry `argt`, `coins(1)` equals `usdt0`, `price_oracle()` no args, 18 decimals, returns `RateReading { source, argtPerUsd, chainId, blockNumber }`; USD₮0 = 1 USD. Add `curve-pool-oracle.test.ts` (fake client) and `curve-pool-oracle.nightly.test.ts` (live Arbitrum). About 170 lines. Package scaffold (`package.json`, `tsconfig`, `index.ts`) included.
  - Satisfies: price-oracles "Happy read", "Wrong coins", "Nightly integration".
  - Acceptance: unit test asserts reading and block; wrong `coins(0)` or `coins(1)` throws; nightly test run manually once and result recorded.

Sequential: 6.1, 6.2, 6.3.

## PR 7: Chainlink feed oracle (`feature/chainlink-feed-oracle`, about 280 lines, T4.5)

Start state: Curve oracle only.
End state: `ChainlinkFeedOracle` with staleness and sequencer safety.
Rollback: revert; remove `chainlink-feed-oracle.ts` and the `decisions.md` row.
Depends on: PR 6.

- [ ] 7.1 `ChainlinkFeedOracle` (D9). One Base block: `decimals()`, `latestRoundData()`, sequencer via V2V3 ABI; reject answer <= 0, `updatedAt` 0 or older than `heartbeatSeconds` (86400 from registry), sequencer answer != 0, `startedAt` 0 or under 3600 s (3600 passes); rate `10^(d+18) / answer`; 1 ARS = 1 ARGt; no `answeredInRound`; injected `now`. About 130 lines code, 130 lines `chainlink-feed-oracle.test.ts`, plus optional `*.nightly.test.ts`.
  - Satisfies: price-oracles "Fresh round", "Stale round", "Sequencer down", "Grace period" (3599 rejected, 3600 accepted), "Sequencer unreadable", "Zero or negative answer".
  - Acceptance: `chainlink-feed-oracle.test.ts` covers each named scenario plus `startedAt` 0; read once live (nightly) and compare with Curve (about 0.03% delta per orchestrator read).
- [ ] 7.2 Update `docs/decisions.md` reference-rates row: Base feed tracks the market rate. About 20 lines.
  - Acceptance: row cites the live read and date.

Sequential: 7.1 then 7.2.

## PR 8: Guarded oracle (`feature/guarded-oracle`, about 230 lines, T4.6)

Start state: two separate oracles.
End state: guarded oracle with 200 bps band, 30 s freeze, shared wiring.
Rollback: revert; remove `guarded-oracle.ts`, `create-guarded-oracle.ts`, doc edits.
Depends on: PRs 6 and 7.

- [ ] 8.1 `GuardedOracle` (D10). `abs(c - l) * 10000 <= 200 * l` in integers uses Curve, else Chainlink with `guarded: true`; any source error throws; `reading()` returns `{ chosen, curve, chainlink, deltaBps, guarded, validUntil }`. About 100 lines with `guarded-oracle.test.ts`.
  - Satisfies: price-oracles "Exactly +2%", "Exactly -2%", "Just outside" (one unit beyond on both sides).
  - Acceptance: tests at exactly +2% and -2% choose Curve; one unit beyond chooses Chainlink guarded.
- [ ] 8.2 Freeze (D11). Per-asset in-flight promise reused while `now < validUntil` (30 s); errors evicted; USDC throws until M9. About 60 lines in the same file and test.
  - Satisfies: price-oracles "Frozen quote / Within window", "Expired".
  - Acceptance: 29 s reuses, 30 s refetches; rejected promise is not cached.
- [ ] 8.3 `createGuardedOracle({ arbitrum, base, addresses, now })` in `create-guarded-oracle.ts`; edit Q12 in `docs/decisions.md` and `docs/demos.md` to say `maxTimeoutSeconds`. About 70 lines.
  - Satisfies: Scenario Coverage "Docs" (Q12 part).
  - Acceptance: wiring test with fakes passes; `rg "maxTimeoutSeconds" docs/decisions.md docs/demos.md` hits both.

Sequential: 8.1, 8.2, 8.3.

## PR 9: `pnpm quote` (`feature/pnpm-quote`, about 170 lines, T4.7)

Start state: guarded oracle with no output layer.
End state: `pnpm quote` prints the documented line; runbook updated.
Rollback: revert; remove `quote-line.ts`, `scripts/quote.ts`, root script, demos.md edit.
Depends on: PR 8.

- [ ] 9.1 `formatQuoteLine` and `runQuote(oracle, io)` in `packages/pricing/src/quote-line.ts` (D12): normal line `1 USD = <x> ARGt (Curve, block N) | Chainlink <y> | Δ <z>% ✓`; guarded line `1 USD = <y> ARGt (Chainlink, guarded) | Curve <x> (block N) | Δ <z>% ⚠`; rates half-up 1 decimal, absolute Δ 2 decimals; prints error and returns exit code on failure. About 90 lines with `quote-line.test.ts`.
  - Satisfies: quote-cli "Within band", "Outside band", "Failure".
  - Acceptance: string equality tests for both lines and a failing source returning non-zero.
- [ ] 9.2 Root `packages/pricing/scripts/quote.ts` (wires `loadRpcUrls`, `createChainClient`, `createGuardedOracle`; sets `process.exitCode`) and root `quote` script. About 40 lines with `scripts/quote.test.ts` source scan.
  - Satisfies: quote-cli "Reuse".
  - Acceptance: source scan finds `createGuardedOracle` and `GuardedOracle` imports from `@hackatwin/pricing` and none of `10000`, `200`, `bps`; `pnpm quote` live output recorded in PR body.
- [ ] 9.3 Runbook. `docs/demos.md` shows both lines, drops "script added during implementation". About 40 lines.
  - Satisfies: quote-cli "Runbook updated / Docs".
  - Acceptance: `rg "script added during implementation" docs/demos.md` returns nothing.

Sequential: 9.1, 9.2, 9.3.

## Deferred (not part of this apply)

- [ ] 10.1 PR 10 `feature/chain-registry-forge` (about 80 lines, T4.1 forge box): `packages/contracts/script/ReadRegistry.s.sol` using `vm.parseJson`. Blocked until T7.1 (Foundry scaffold) merges; Solidity strict TDD (Q21) applies then.
  - Satisfies: chain-registry "Deferred box".

## Scenario coverage check

Every spec scenario is assigned to a task above: chain-registry (2.2, 2.3, 10.1), chain-client (3.2, 3.3, 4.1, 4.2), registry-verification (5.1), core-domain-ports (1.1, 1.2), config-profiles (1.3), price-oracles (6.1, 6.3, 7.1, 8.1, 8.2), quote-cli (8.3, 9.1 to 9.3).

## Dependency graph

PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5 -> PR 6 -> PR 7 -> PR 8 -> PR 9 (stacked, merge in order). Logical dependencies are looser (PRs 4 and 5 and PRs 6 and 7 are independent of each other), but the stack is linear to keep bases clean; independent pairs may be built in parallel worktrees only if the user approves.
