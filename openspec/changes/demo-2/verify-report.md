```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:be0f1a9b837afb79a6cdd4f830e5ee1cc00799f383d7cfb865408e7c3c0d9114
verdict: fail
blockers: 1
critical_findings: 1
requirements: 43/44
scenarios: 110/113
test_command: pnpm vitest run --project default
test_exit_code: 0
test_output_hash: sha256:6ae8c7a7461c582b9a98c7c7bf597a650d7662206cb23fb1f4ca92edeaddc74d
build_command: forge build
build_exit_code: 0
build_output_hash: sha256:68e4ed0c77bd2ec112abde6f2b3ac30b284fda822b59cc1e2e842d6427f78edf
```

## Verification Report

**Change**: demo-2 (PLAN M8, local cross-chain dev base)
**Version**: N/A
**Mode**: Strict TDD
**Code under test**: `origin/feature/e2e-crosschain-relay` at `0984bcf` (PR #270, stack #226 to #270, 61 commits since `3a5c8c4`). Working tree clean.
**Verdict**: FAIL on the strict rule (1 CRITICAL: a spec scenario with no covering test). The behavior itself holds by source search; the fix is one small guard test. 1 CRITICAL, 7 WARNING, 6 SUGGESTION.

### Completeness

| Metric | Value |
|---|---|
| Tasks total | 41 |
| Tasks complete | 41 |
| Tasks incomplete | 0 |

### Build and tests execution

| Command | Result |
|---|---|
| `cd packages/contracts && forge build` | exit 0 (lint notes only) |
| `cd packages/contracts && forge test` | exit 0, 236 passed, 0 failed, 1 skipped (237), 38 suites. Flaky InvariantPaymentHub family did not appear |
| `bulloak check test/utils/*.tree` | all checks pass |
| `pnpm vitest run --project default` | exit 0, 113 files, 866 tests passed |
| `pnpm test:local` (real anvils; `pgrep -l anvil` empty before) | exit 0, 8 files, 37 tests passed, 31.5 s |
| `pnpm -r --if-present typecheck` | exit 0 |
| `pnpm biome check .` | exit 0, 423 files, no fixes |
| `pgrep -l anvil` after | empty |

Coverage: not available (no coverage tool configured for this change). Unavailable layers: none except real testnet (T8.6, expected OPEN).

### Strict TDD evidence

Git history shows a `test(...)` commit before each `feat(...)` commit in every PR (c4ca540 then cb248f5; 77b5016 then 58e0f86; 4931bca then 0ebc580; d666354 then 7a9fa2f; cfbe910 then 89dc104; c3463ef/e00df85/85518a9 then bf86ebc/0df8004; bb2f7cf then 5a525d1; 4da2728/a28b985 then 90d3567/89dac65; d539477 then ab1f5ed; de8284e then 56c48a8; d447570 then 117cc6a; d774163 then 448628e; 1cc4d22 then 1b3d1be; e3047af then 6b203ab; 5589a22 then 5b05ac3; 10c0ef7 then 7c1e220; 7d3aa1c then d222831; b26ca47 then 3a963c9; 863eb70 then 9ac0d78; 7e88e76 then 26c0610; b8f5de2 then 5b25b13; 2c6b64f then 62e84fb; aea68f6 then e84f47c). Bulloak trees for the Solidity utilities pass `bulloak check`. The PR 16 e2e suite (0984bcf) is the test itself; its red step is the root progress unit test (aea68f6). Compliant.

### Spec compliance matrix

Totals counted from the retrieved specs: 11 capability specs, 44 requirements, 113 scenarios (RENAMED and MODIFIED included).

| Capability | Requirements | Result | Evidence (test file, runtime pass) |
|---|---|---|---|
| local-crosschain-environment | 5 | PASS | `anvils.test.ts`, `anvils.local.test.ts` (IDs 31337/31338, Forbidden ID), `icm-fetch.test.ts` (Cache hit), `license-guard.test.ts` (License guard, Bare token), `world.local.test.ts` (Teleporter address, Remote registered), `spike-teleporter.local.test.ts` (Round trip), `world-contracts.local.test.ts` (Registry untouched, Source key), `forge-run.test.ts`, `deploy.local.test.ts` (Both scripts, No private key), `script-diff.local.test.ts` (Script diff), `demo-2.local.test.ts` Clean tree |
| icm-relay-simulation | 4 | PASS | `WarpMessengerStub.t.sol`, `LocalUsdc.t.sol`, `warp-stub-guard.test.ts` (No script deploys it), `relay.local.test.ts` (Hub to L1, L1 to hub, No double delivery, Delivery reverts), `relay-cursor.test.ts`, `relay-loop.test.ts`; tree covered by `bulloak check` |
| local-crosschain-profile | 3 | PASS | `local.test.ts`, `anvil.test.ts`, `guarded-local.test.ts` (Loopback write, Wrong chain ID, Remote host), `explorer.test.ts` (Local hash) |
| config-profiles | 4 (1 renamed, 1 modified, 2 added) | PASS | `load-profile.test.ts` (five profiles, Live keys ignored, Two bad values, Remote RPC, Live chain ID, No chain ID env key, Local profile loads), `env-example.test.ts`, `child-env.test.ts` |
| contracts-deployment | 1 | PASS | `forge-run.test.ts` (Local unlocked sender, Unlocked on a remote host, No private key); Dry-run scenarios unchanged and green in `forge test` |
| core-domain-ports | 2 | PASS | `agent-event.test.ts` (Marker round trip/absent/base/other value, Hop with/without link), `guarded-local.test.ts` (Call with value), `fakes.test.ts`, typecheck for Compile check |
| simulated-run-labeling | 4 | PARTIAL | See findings C1 and W7. Marker, CLI first line, Scan, Hop without link, Save refused, Real run saves, Stamped by the channel, Other value rejected: PASS (`event-channel.test.ts`, `recording.test.ts`, `replay-source.test.ts`, `entry.test.ts`, `labels.test.ts`, `demo-2.local.test.ts` Scan). Same selector: PARTIAL. Selector lookup banned: UNTESTED |
| crosschain-messaging-local | 4 | PASS | `sender.test.ts` (Happy path, Fee paid, Unsupported, Fake client, Unscripted call, Transport) |
| hop-tracking | 5 | PASS with note | `tracker.test.ts`, `tracker-decode.test.ts`, `log-reader.test.ts`, live decode in `demo-2.local.test.ts`. Resume mid-flight: PARTIAL (W2) |
| demo-2-payment-flow | 6 | PASS | `setup.test.ts` (First run, Second run, Profile budget, Missing budget names `budget.total`, Output), `deployment.test.ts`, `tools.test.ts`, `entry.test.ts` (One payment, No key, Run events), `module.test.ts` (Registration only, Fund an L1 address), `ictt-funding.test.ts`, `demo-2-runbook.test.ts` (Commands exist) |
| crosschain-protocol-e2e | 6 | PASS | `demo-2.local.test.ts` (Hub, Receiver, One event per hop, Not allowlisted, Fallback balance, Full track, Resume, Scan in suite, Teardown, Clean tree), `workflow-guard.test.ts` (CI job), `anvils.local.test.ts` (No external inputs, Teardown) |

Scenario totals: 110 COMPLIANT, 2 PARTIAL (hop-tracking Resume, labeling Same selector), 1 UNTESTED (labeling Selector lookup banned).

### Done-when traceability (docs/PLAN.md M8)

| Item | Done-when | Status | Evidence |
|---|---|---|---|
| T8.1 | Lane check and fee quote before send | DONE | `sender.test.ts` Happy path, Unsupported |
| T8.1 | Status from CCIP API `GET /v2/messages/{id}` | OPEN (expected) | Needs real testnet (D12); local transport makes no HTTP call |
| T8.1 | Unit tests use a fake `ChainClient` | DONE | `sender.test.ts` Fake client |
| T8.2 | Each hop carries explorer links | OPEN (expected) | Local hops omit links by spec; M6 closes |
| T8.2 | Tracking resumes from a message ID | DONE | `tracker.test.ts` Resume, e2e Resume (W2 on wording) |
| T8.2 | Unit tests replay recorded logs | PARTIAL | Fixture is encoded from event ABIs, not captured (W5); live decode proven in e2e |
| T8.3 | Idempotent | DONE | `setup.test.ts` Second run; hand check recorded in apply-progress |
| T8.3 | Budget from the profile | DONE | Profile budget, Missing budget |
| T8.3 | Prints lane `Id` and remaining budget | DONE | Output |
| T8.4 | Tools trigger and track one payment end to end | DONE | `tools.test.ts`, `entry.test.ts`, e2e Full track |
| T8.4 | Module exposes ICTT funding of an L1 address | DONE | `module.test.ts`, e2e ICTT funding |
| T8.4 | demos.md steps use real commands | DONE | `demo-2-runbook.test.ts` |
| T8.5 | Contracts deployed by the real deploy scripts | DONE | `deploy.local.test.ts`, e2e first test (recording runner sees DeployFuji, DeployL1) |
| T8.5 | `Pending to Dispatched to Received to Settled` | DONE | e2e Hub, Receiver, One event per hop |
| T8.5 | `Rejected` path and fallback balance | DONE (local pair only) | e2e Not allowlisted, Fallback balance, Broker rejection |
| T8.6 | Testnet smoke | OPEN (expected) | Out of scope |

### Design coherence

| Decision | Honored | Evidence |
|---|---|---|
| D1 relay loop in `demo2:local:up` | Yes | `e2e/protocol/src/local/up.ts` calls `runRelayLoop` with a cursor; SIGINT/SIGTERM kill both anvils; `relay-loop.test.ts`; hand check in apply-progress |
| D7 relay keying | Yes | ID from Teleporter `SendCrossChainMessage`, bytes from stub `WarpMessageSent`, skip on `messageReceived(id)`; `relay.local.test.ts` No double delivery |
| D10 budget probe | Yes | `setup.ts` `eth_call pay(...)` decodes `LaneNotFound`, `Unauthorized`, `BudgetExceeded(remaining)`; no storage-slot read |
| Labeling SIMULATED | Yes | `simulatedOf(profile)` feeds `createEventChannel({ simulated })`; every e2e event carries the marker |
| Recording refusal | Yes | `recording.test.ts`, `replay-source.test.ts` |

### Project rules

| Rule | Result |
|---|---|
| No `--private-key` anywhere | PASS: only three negative assertions in tests (two in `forge-run.test.ts`, one in `workflow-guard.test.ts`); none in code or workflows |
| Keystores only | PASS: unlocked sender only after loopback probe, fixed argv, `shell: false` |
| No AI attribution in commits | PASS: 61 commit messages scanned, no match |
| No AI attribution in PRs and issues | PASS: 23 PR bodies and 23 issue bodies scanned; the one regex hit (#262) is the text `ANTHROPIC_API_KEY`, not attribution |
| No U+00B7 | PASS: none in added lines |
| One-line comments | PASS: no block comments added in source; spot check of 119 added `//` lines found single-line comments |
| No mocks in demos | PASS: `vi.spyOn` only asserts no `fetch` call or no `resolve`; `*.fixtures.ts` helpers are imported by tests only; the e2e suite runs on real anvils |
| Nothing from `.cache/` tracked | PASS: `git ls-files .cache` empty |
| No `LicenseRef-Ecosystem` file tracked | PASS: only `docs/PLAN.md` (bare token) and the guard test mention it, both allowed |
| `packages/contracts/src` and `script` unchanged | PASS: `git diff 3a5c8c4 HEAD -- packages/contracts/src packages/contracts/script` is empty; `script-diff.local.test.ts` green |

### Per-PR size (authored, added + removed, pnpm-lock excluded; measured between consecutive PR heads)

| PR | Lines | PR | Lines | PR | Lines |
|---|---|---|---|---|---|
| #226 | 297 | #242 | 363 | #256 | 72 |
| #228 | 326 | #245 | 239 | #254 | 376 |
| #230 | 103 | #246 | 256 | #258 | 265 |
| #232 | 185 | #248 | 245 | #260 | 319 |
| #234 | 215 | #251 | 341 | #262 | 206 |
| #236 | 402 | #252 | 508 | #264 | 325 |
| #238 | 234 | #240 | 342 | #266 | 209 |
| #268 | 80 | #270 | 322 | | |

Over 400: #236 (402 total, 399 added), #252 (508 total, 111 of them a JSON fixture; about 397 without it). Everything else is within budget.

### Findings

#### CRITICAL (1)

C1. UNTESTED scenario: simulated-run-labeling, "Selector lookup banned" (GIVEN the local label code WHEN searched for selector-to-name lookups THEN none exist). No test searches for it. Source search found none (`labels.ts` derives the marker from the profile; the only `registry` import in the demo is `txUrl`), so the behavior holds, but the skill rule requires a passing covering test. Smallest fix: add a Vitest guard in `demos/02-l1-crosschain/labels.test.ts` that reads `labels.ts`, `root.ts` and `payment-agent/*.ts` (non-test) and asserts they contain no `16015286601757825753`, no `sepolia` literal and no import of a selector-to-name lookup from the registry (about 10 lines; RED by planting a lookup, then GREEN). Also strengthen "Same selector" with a unit test that builds labels for a profile with source selector `16015286601757825753` and asserts no `Sepolia` text.

#### WARNING (7)

W1. Known point 1: `adapters/sender.ts` `DEFAULT_GAS_LIMIT = 200_000` reverts on the real broker (needs over 500000; 1000000 runs out in the ICTT dispatch). The only production wiring (`root.ts` `CCIP_GAS_LIMIT` 3000000) overrides it and the e2e proves it, so no live failure, but a new caller gets a broken default. Fix: make `gasLimit` required, or default to the broker-safe value.
W2. Known point 3: hop-tracking "Resume mid-flight" says hops 0 and 1 emitted, then only 3 and 4 follow. That skips index 2, so the literal text contradicts "emit only hops not yet emitted". The tested interpretation (0 to 2 emitted, then 3 and 4) is correct; PARTIAL against the literal text. Fix at archive: amend the scenario to "hops 0 to 2 already emitted".
W3. Known point 5: ICTT `CallFailed` carries no payment ID, so `tracker.ts` matches it by recipient (the receiver). Two in-flight payments to one receiver could mis-attribute a failure. Acceptable for the local one-payment demo; document the limit in the demos doc or key by amount plus recipient.
W4. Known point 11: a one-off 300 s hang in `deploy.local.test.ts` on a stuck `forge script DeployFuji` (apply-progress). Not reproduced: the full `pnpm test:local` here passed in 31.5 s. Risk of a CI stall without a per-test timeout; consider an explicit `testTimeout` and a forge-script timeout in the wrapper.
W5. Known point 6: no recorded-log fixture file. `adapters/fixtures/local-happy.json` is encoded from the event ABIs, while PLAN T8.2 says "replay recorded logs" and apply-progress promised PR 16 would record real ones. Decoding of live logs is proven in `demo-2.local.test.ts`, so ABI drift is covered. Fix: capture one live run to a fixture, or reword the PLAN item.
W6. Known point 7: the script-diff guard is pinned to commit `3a5c8c4` (`DEMO2_BASE` in `script-diff.local.test.ts`). `develop` is a single initial commit, so it cannot compare to the merge base. Drop or repoint it at archive, or it will fail on the first legitimate contract change.
W7. Labeling "Same selector" is only covered indirectly by the e2e Scan on a run that uses the Sepolia-equal selector; no assertion that the source is labeled by the profile (see C1 fix).

#### SUGGESTION (6)

S1. Known point 2: #252 is 508 lines, 111 of them generated JSON fixture; about 397 of code and tests. Within budget in substance; note the exemption in the PR.
S2. #236 is 402 lines (399 added), marginally over 400; the split already used the seam. No action.
S3. Known point 4: `Rejected` reason lives on `TrackedHop.reason`, core `Hop` unchanged (no wire change). The spec says the hop carries the broker reason; it reaches the agent output through the tracker. Align the spec wording or add an optional core `reason` later.
S4. Known point 8: a budget of exactly 0 signs a fresh authorization on the next setup. The spec says re-runs must not change the budget; the exhausted case is a design choice (D10), recorded in apply-progress. State it in the spec.
S5. Known point 9: the lane shape (merchant role, enabled messenger, L1 blockchain ID) is not fixed by the spec. Add one sentence to the payment-flow spec.
S6. Known point 10: the Claude LLM path is untested at runtime (only the key requirement is covered; no key available locally). Out of scope for the local base; cover in T8.6.

### Issues blocking archive

C1 only. After the guard test lands (new PR on the queue or an addition to the tip), the verdict becomes PASS WITH WARNINGS. W2 and W6 are archive-time actions.
