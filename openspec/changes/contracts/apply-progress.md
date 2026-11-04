# Apply progress: contracts (M7 code subset)

Mode: Strict TDD (forge test; Vitest for TypeScript). Store: hybrid. Chain: stacked-to-main, every PR targets `develop`.

## Batch 5 (PR 15a to PR 16b): tasks 15.1, 15.2, 16.1, 16.2, 17.1 complete (33 of 33 task rows)

PR 15 split at named seams into 15a (registry ICM reads, optional `icm.*` schema fields, ADR 0011), 15b (deploy base), 15c (Fuji script); PR 16 split into 16a (L1 script) and 16b (fixture drift, dry-run CI job, README templates, PLAN close-out). Own issues, later numbering unchanged, no size exception. All PRs target `develop`, stacked from `feature/broker-invariants`. Dry-run only: no broadcast flag, no key, no transaction to any RPC (anvil stayed at block 0; the Fuji fork run only reads).

| PR | Branch | PR / issue | Authored lines | Commits |
|---|---|---|---|---|
| 15a | `feature/registry-icm` | #160 / #159 | 250 | tree 88b795c, red 12bc22d, green ea56b12, chains 8677099, ADR 26f6d94 |
| 15b | `feature/deploy-base` | #162 / #161 | 301 | tree c99720a, red 2b0025e, green c22af54 |
| 15c | `feature/deploy-fuji` | #164 / #163 | 393 | tree 492a854, red 46e1109, green d0703b5, trim 4d879e5, format d3dd074 |
| 16a | `feature/deploy-l1` | #166 / #165 | 323 | tree cfa1ec0, red 1f1dc0c, green 40218bf, fixup 0fb6906 |
| 16b | `feature/deploy-dry-run` | #168 / #167 | 211 | drift red 1b2174b, green 365eee2; templates red 2e92cb0, green fae3933; CI 92eb146; PLAN b173c09 |

All five PRs: CI green (every check including `ci-gate`; 16b also runs the new `contracts dry-run` job).

## Batch 5 TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 15.1, 15.2 (PR 15a) | `test/unit/RegistryIcm.t.sol`, `packages/chains/src/registry.test.ts` | Unit | 177 baseline | Written, build fails (`Registry.chainIdOf` missing) | 6/6 forge, 11/11 vitest | real and fixture registries, missing file, field and entry; malformed blockchain ID, checksum, unknown icm field | None needed |
| 15.1, 15.2 (PR 15b) | `test/unit/Deploy.t.sol`, `scripts/deploy-safety.test.ts` | Unit | 177 baseline | Written, build fails (`script/Deploy.sol` missing); vitest guard was already green (standing check) | 8/8 forge, 4/4 vitest | match, another chain, 43114; entry, missing entry, missing file; 4 refused write paths and the allowed one | Harness ordering |
| 15.1, 15.2 (PR 15c) | `test/unit/DeployFuji.t.sol` | Unit and fork | 185 baseline | Written, build fails (`DeployFuji` missing) | 11/11 pass, fork test 1 pass with `FUJI_FORK=1` | nonce 0 and 7, no pair and one pair, fixture and partial registry, mainnet, committed params | Fixture trims to 393 lines |
| 16.1, 16.2 (PR 16a) | `test/unit/DeployL1.t.sol` | Unit | 196 baseline | Written, build fails (`DeployL1` missing) | 11/11 pass; anvil simulation succeeds | real registry, fixtures, 43114, no record; Fuji then L1 deploy, moved nonce, stale record, 0 and 2 merchants, dry-run, serializer | Fixed a missing-blockchain-id fixture clash |
| 16.1, 16.2 (PR 16b) | `scripts/fixture-drift.test.ts`, `scripts/readme-templates.test.ts` | Unit | N/A (new) | Written, imports and sections missing | 3/3 and 3/3 pass | equal facts, 3 drifted facts, fixture-only facts; both commands, settings, label | None needed |
| 17.1 | n/a (docs) | Docs | n/a | n/a | PLAN.md boxes ticked | n/a | n/a |

Totals after batch 5: forge 207 pass and 1 skipped (Fuji fork), Vitest 438 in the repository.

### Batch 5 deviations and notes

- Splits: 15 into 15a to 15c and 16 into 16a and 16b (each over 400 lines as one PR). Per-PR authored lines 250, 301, 393, 323, 211: all within 400.
- Params files are named after the chain key (`twinpay-l1.json`, not `l1.json`) because the base reads `<chainKey>.json`. Committed `script/params/fuji.json` holds the gas limits only (500000 required, 300000 recipient); `twinpay-l1.json` holds an empty merchant list. Deployer, owner, fallback recipient, receiver deployer and nonce arrive with T7.12, so a real run reverts `Deploy_ParamNotFound` (and `Registry_EntryNotFound` until M6 fills the ICM facts).
- The L1 receiver token equals its transferrer (the ICTT remote contract is its own ERC-20).
- `packages/chains/deployments/.gitkeep` was added: Foundry cannot resolve the read-write `fs_permissions` path while the directory is missing.
- The Fuji fork test is gated by `FUJI_FORK=1`; CI runs it as a `continue-on-error` informational step so a flaky public RPC cannot block `ci-gate`. The L1 dry-run on anvil is a blocking step and asserts anvil stayed at block 0 and the tree is clean.
- Fixtures live in `test/fixtures` (registry, params, params-pair, params-merchant, params-missing, registry-partial, deployments). The drift guard is a pure TypeScript function compared against the real registry (facts only the fixture has are not drift).
- Snowtrace is served by Routescan; the Etherscan-compatible read API answered for Fuji (`getabi` on the USDC contract, 2026-11-04), a verify submit was not exercised. The Builder Hub verifier command is labeled UNVERIFIED.
- Tests set `vm.chainId` rather than fork mainnet for the unsupported-chain case. Tests that switch to a fork need `vm.makePersistent` on the script contract.
- After editing a shared fixture (Fuji `icm.blockchainId`) a PR 15a test failed in PR 16a and was fixed with a follow-up commit; read the whole `forge test` tail before committing.
- 17.1: T7.1 to T7.8 (O7 human sign-off in T7.2 stays open) and T7.10 Done-when boxes ticked in `docs/PLAN.md`; T7.9, T7.11, T7.12 marked pending.
- Out of scope and still pending: broadcast, real keystores and params (T7.12), T7.9, T7.11, M8 gas re-measurement with the real ICTT messenger.

## Remaining

None in this change: all 33 task rows are done. Next: sdd-verify.

## Batch 4 (PR 13 to PR 14b): tasks 13.1, 13.2, 14.1, 14.2 complete (28 of 33 task rows)

PR 13 split at named seams into 13, 13b and 13c (own issues, later numbering unchanged). All PRs target `develop`, stacked from `feature/settlement-receiver-invariants`.

| PR | Branch | PR / issue | Authored lines | Commits (tree, red, green) |
|---|---|---|---|---|
| 13 | `feature/broker-allowlist` | #150 / #149 | 340 | tree 91efaee, red fbb1715, green 7ab0b3c |
| 13b | `feature/broker-message` | #152 / #151 | 252 added (273 changed) | tree 21cd003, red 396d6ad, green b54523e |
| 13c | `feature/broker-refusal` | #154 / #153 | 268 | tree ce71c8a, red 27ed876, green 0bac43d |
| 14a | `feature/broker-simulator` | #156 / #155 | 117 | tree 81616a2, red d243701, green 89f5e23 |
| 14b | `feature/broker-invariants` | #158 / #157 | 253 | red f126b68, green bb4c9f7 |

All five PRs: CI green (12 checks each). Full forge suite at the stack tip: 170 tests.

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 13.1, 13.2 (PR 13) | `test/unit/PaymentBrokerEntry.t.sol`, `scripts/broker-abi.test.ts` | Unit and ABI | N/A (new) | Written, build fails (broker missing); vitest fails | 10/10 forge, 2/2 vitest | 2 non-router callers, 1 and 2 tokens, 4 bad sizes, mixed and unknown pairs with tokens attached | None needed |
| 13.1, 13.2 (PR 13b) | `test/unit/PaymentBrokerMessage.t.sol` | Unit | 10/10 PR 13 baseline | Written, build fails (`statusOf` missing) | 17/17 | 2 matching pairs, both foreign directions, replay with tokens and bad data, replay after removal, rebinding, 2 dirty-bit words; 2 mutations killed | None needed |
| 13.1, 13.2 (PR 13c) | `test/unit/PaymentBrokerRefusal.t.sol`, `test/gas/PaymentBrokerGas.t.sol` | Unit and gas | 17/17 baseline | Written, build fails (`DispatchFailed`, `MIN_RELAY_GAS` missing) | 25/25; snapshot check exits 0 after refresh | 5 hub refusals, failed dispatch recovered and refunded, starved call and redelivery; 2 mutations killed | None needed |
| 14.1 (PR 14a) | `test/integration/BrokerSimulator.t.sol` | Integration | 25/25 baseline | Written, build fails (`SimulatorFixture` missing) | 3/3 | reject (not allowlisted and malformed), router replay, accept; 3 mutations killed | None needed |
| 14.2 (PR 14b) | `test/invariants/PaymentBroker.invariants.t.sol` | Invariant | N/A (new) | Written, build fails (handler missing) | 4 invariants, 64 runs, 0 reverts; deep 512 runs | 3 pairs, 3 payers, forced accept, mismatch, refusal and failed dispatch; 5 mutations killed | None needed |

### Batch 4 deviations and notes

- Splits: PR 13 into allowlist and payload checks (13), message guard, payer binding and accept path (13b) and hub refusal, dispatch failure, gas floor and gas test (13c), because the full unit measured well above 400 authored lines. In 13 the broker accepts a valid message without side effects; 13b adds the hub calls plainly and 13c wraps them in `try`.
- Contracts live in `src/` (`PaymentBroker.sol`, `interfaces/IPaymentBroker.sol`). The interface was grown per PR (events, errors and functions are declared with the code that uses them).
- "No public entry" is asserted by a Vitest test over the exported ABI (the only state-changing entries are `ccipReceive` and the owner functions), because Foundry cannot enumerate selectors on chain and `fs_permissions` does not allow reading `out/`.
- `MIN_RELAY_GAS` is 500000 and the documented CCIP `gasLimit` is 800000 (accept path measured at 313450 with the test messenger). The real ICTT send is not in the measured number; M8 must re-measure with the real messenger.
- The decoded payer word is checked for dirty high bits (`PaymentBroker_InvalidPayload`), as the receiver does, because `abi.decode` of a dirty address would revert without data.
- The simulator assigns a fresh message ID to every send, so the duplicate scenario replays through the router's `routeMessage` with the processed ID.
- `PaymentBrokerHandler` reuses `BrokerFixture`; invariant 4 is checked as `granted == paid + remaining` (stricter than `paid <= granted`) because the broker is the only spender of the budgets.
- The invariant suite has no Bulloak tree (as in batch 3). Nightly already runs the whole suite under the `deep` profile.

## Batch 3 (PR 9 to PR 12b): tasks 9.1, 10.1, 10.2, 11.1, 12.1 complete (24 of 33 task rows)

Every task row split at a seam, each with its own issue, later numbering unchanged. All PRs target `develop`, stacked from `feature/hub-dispatch`.

| PR | Branch | PR / issue | Authored lines | Commits (tree, red, green) |
|---|---|---|---|---|
| 9 | `feature/hub-invariants` | #134 / #133 | 335 | red 4b8ae91, green 55aeaed, nightly 4cb6847 |
| 9b | `feature/hub-gas` | #136 / #135 | 124 | tree 54feb9f, red bfb4769, green 48b7fa7 |
| 10 | `feature/icm-messenger` | #138 / #137 | 249 | tree 8c87ad5, red 032250f, green 785ed61 |
| 10b | `feature/icm-messenger-send` | #140 / #139 | 263 | tree 878e875, red a1de96e, green d1aeb40, ADR 59445f1 |
| 11 | `feature/settlement-receiver` | #142 / #141 | 349 | tree c8dfeef, red d756bd3, green 24ba986 |
| 11b | `feature/settlement-receiver-outcome` | #144 / #143 | 257 | tree c39e867, red 64cc231, green e8b8f6e |
| 12 | `feature/settlement-receiver-callback` | #146 / #145 | 273 | tree 7925db2, red edb7934, green a291587 |
| 12b | `feature/settlement-receiver-invariants` | #148 / #147 | 334 | tree 48d7930, red c622001, green 19504ae |

All eight PRs: CI green (12 checks each). Full forge suite at the stack tip: 138 tests.

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 9.1 (PR 9) | `test/invariants/PaymentHub.invariants.t.sol` | Invariant | N/A (new) | Written, build fails (handler missing) | 2 invariants, 64 runs, 0 reverts; deep 512 runs | 2 tokens, 8 lanes, warps, retries; 3 mutations killed (over-credit, refund keeps Pending, refund selector dropped) | None needed |
| 9.1 (PR 9b) | `test/gas/PaymentHubGas.t.sol` | Gas | N/A (new) | `forge snapshot --check` exits 1 (no snapshot) | 6/6 pass, check exits 0 | pay local and cross, settle, dispatch, refund, withdraw | None needed |
| 10.1 (PR 10) | `test/unit/IcttMessenger.t.sol` | Unit | N/A (new) | Written, build fails | 4/4 pass | 4 gas-limit pairs, 6 zero addresses, zero id | Docs and imports |
| 10.1, 10.2 (PR 10b) | `test/unit/IcttMessengerSend.t.sol` | Unit | N/A (new) | Written, build fails | 6/6 pass | non-hub, foreign destination and token, zero, input fields, approval residue, one event, revert; approve plus one mutation killed | None needed |
| 11.1 (PR 11) | `test/unit/SettlementReceiverValidation.t.sol` | Unit | N/A (new) | Written, build fails | 8/8 pass | 5 mismatches, order, source before payload, 4 bad payloads, 3 used statuses; 2 mutations killed | None needed |
| 11.1 (PR 11b) | `test/unit/SettlementReceiverOutcome.t.sol` | Unit | 8/8 PR 11 baseline | Written, build fails | 16/16 pass | allow, remove, zero, non-owner, settle, pull fail, reject, fallback sweep; 2 mutations killed | None needed |
| 12.1 (PR 12) | `test/unit/SettlementReceiver{Withdraw,Callback}.t.sol` | Unit | 16/16 baseline | Written, build fails | 19/19 pass | credit, two merchants, no credit, ok, revert and burn gas, reentrant withdraw, starved and funded gas; 3 mutations killed | None needed |
| 12.1 (PR 12b) | `test/invariants/SettlementReceiver.invariants.t.sol`, `test/gas/SettlementReceiverGas.t.sol` | Invariant and gas | N/A (new) | Written, build fails (handler missing); snapshot check exits 1 | 3 invariants, 64 runs, 0 reverts; deep 512 runs; 4/4 gas | 3 merchants, valid, invalid and duplicate deliveries; 3 mutations killed; coverage assert caught a vacuous run | Handler forces one rejection |

### Batch 3 deviations and notes

- Splits: PR 9 into invariants (9) and gas (9b), because the full unit measured 459 authored lines; PR 10 into configuration (10) and `send` plus ADR 0010 (10b), because the full messenger measured 463 and the lintspec rules (`inheritdoc`) needed the interface getters; PR 11 at step 8 instead of the named reject-path seam (11 = steps 1 to 7, 11b = allowlist, settle and reject), because a receiver with a settle path but no reject path has no defined behavior for a non-allowlisted merchant; PR 12 into withdraw and callback (12) and invariants plus gas bound (12b).
- Contracts live in `src/` (not `src/contracts/`) like `PaymentHub`.
- The invariant suites have no Bulloak tree: Bulloak scaffolds `test_` functions only. Gas suites do.
- Nightly runs the existing `deep` profile (depth 200, runs 512), not depth 100: the profile already existed in `foundry.toml`.
- `forge snapshot --check --tolerance 1 --match-path 'test/gas/*'` runs in the `contracts` CI job; the assertions never hard-code gas numbers except the documented `recipientGasLimit` 300000 ceiling for the settled path with a callback.
- `TestTokenTransferrer` models both sides: `sendAndCall` pulls the amount and sweeps unused allowance to the fallback (home side), `deliver` approves the receiver, calls it and sweeps what it did not pull or the whole amount on a revert (remote side).
- The receiver reuses `PaymentCallbackLib` (`CALLBACK_GAS` 100000, `GAS_RESERVE` 30000) and the `CallbackMerchant` double (new `WithdrawFromCaller` mode).
- A payload whose merchant word has dirty upper bits reverts `SettlementReceiver_InvalidPayload` (extra over the spec's 64 byte rule).
- The README gas table documents hub and receiver gas; the documented `recipientGasLimit` is 300000 and the callback cap needs about 131.6k gas left.
- The task counts earlier read "of 29"; the tasks file has 33 rows.

## Batch 2 (PR 5 to PR 8c): tasks 5.1, 6.1, 7.1, 8.1, 8.2 complete (19 of 29 task rows)

PR 7 split at `refund` (7b) and PR 8 split into settle and withdraw (8), callback policy (8b) and `dispatch` (8c); each split has its own issue, later numbering unchanged. `IMessenger` moved from 8.1 to 8c. All PRs target `develop`, stacked from `feature/payment-state-lib`.

| PR | Branch | PR / issue | Authored lines | Commits (tree, red, green) |
|---|---|---|---|---|
| 5 | `feature/hub-lanes` | #120 / #119 | 399 | tree aa8de67, red d059d6b, green 26694a0 |
| 6 | `feature/hub-authorization` | #122 / #121 | 273 | tree 6af5ab0, red a810138, green 0c71b44 |
| 7 | `feature/hub-pay` | #124 / #123 | 312 | tree 3c98ace, red b0b3dab, green 4afc24e, tree-name fix 573f8c4 |
| 7b | `feature/hub-refund` | #126 / #125 | 150 | tree 3e894fa, red 5a6b5a6, green be2309d |
| 8 | `feature/hub-settle` | #128 / #127 | 238 | tree 90c9e4a, red 42ee7c4, green cff2572 |
| 8b | `feature/hub-callback` | #130 / #129 | 258 | tree eacb273, red 9cf412c, green f4c052f |
| 8c | `feature/hub-dispatch` | #132 / #131 | 242 | tree 2083280, red 048f89a, green 197fec6 |

All seven PRs: CI green. Full forge suite at the stack tip: 90 tests.

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 5.1 | `PaymentHubLanes.t.sol`, `PaymentHubTransition.t.sol` | Unit | N/A (new) | Written, build fails | 16/16 pass | 8 lane cases, every non-table edge, every wrong from-state | None needed |
| 6.1 | `PaymentHubAuthorization.t.sol` | Unit | N/A (new) | Written, build fails | 11/11 pass | EOA, ERC-1271 approve and reject, replay, wrong nonce, expiry and equal deadline, chain id, hub address | None needed |
| 7.1 | `PaymentHubPay.t.sol` | Unit | 4/4 harness-stub baseline | Written, 11 of 12 fail at runtime | 12/12 pass | self-pay, broker, cap, spent budget, fee token, zero delta, distinct ids | None needed |
| 7.1 (7b) | `PaymentHubRefund.t.sol` | Unit | N/A (new) | Written, 6 of 6 fail at runtime | 6/6 pass | past, at and before deadline, 4 wrong states, double refund, other lane | None needed |
| 8.1 | `PaymentHubSettle.t.sol`, `PaymentHubWithdraw.t.sol` | Unit | N/A (new) | Written, build fails | 9/9 pass | before and at deadline, 4 wrong states, cross chain, late, two tokens | None needed |
| 8.1 (8b) | `PaymentHubCallback.t.sol` | Unit | N/A (new) | Written, build fails | 5/5 pass | ok, revert, burn gas, starved and funded gas, reentrancy | Test double packed to fit the 100000 gas cap |
| 8.2 | `PaymentHubDispatch.t.sol` | Unit | N/A (new) | Written, build fails | 8/8 pass | before and at deadline, 4 wrong states, local, late, send revert, short pull, no refund | None needed |

### Batch 2 deviations and notes

- `PaymentHub` stays `abstract` until PR 8c; `test/utils/PaymentHubHarness.sol` stubs unbuilt functions and shrinks each PR.
- A fully spent budget reads `PaymentHub_Unauthorized` (budget 0 means no authorization); a non-zero budget below the amount reverts `PaymentHub_BudgetExceeded`.
- `refund`, `settle` and `dispatch` run `_transition` first, so wrong-state errors win over deadline errors.
- Reentrancy of `dispatch` is asserted in PR 8c, since the function did not exist in 8b.
- Callback constants: `CALLBACK_GAS` 100000, `GAS_RESERVE` 30000 (design leaves the numbers open).
- Bulloak tree names cannot contain hyphens either (PR 7 follow-up 573f8c4).
- Remaining spec items for PR 9: invariants, nightly workflow, gas snapshot.

## Batch 1 (PR 1a to PR 4): tasks 1.1 to 4.1 complete (14 of 29 task rows)

| PR | Branch | PR / issue | Authored lines | Commits (tree, red, green) |
|---|---|---|---|---|
| 1a | `feature/contracts-scaffold` | #108 / #107 | 165 | config fb3264e, red 32d2465, green 41b1a8b |
| 1b | `feature/contracts-ci` | #111 / #109 | 339 | red cb225cd, green 7c8faaa, CI de318f4 |
| 1c (split from 1b) | `feature/contracts-abi-export` | #112 / #110 | 167 | red f9fd306, green a1721f4, CI d6dec95 |
| 2 | `feature/chain-registry-forge` | #114 / #113 | 246 | tree d6250f2, red d73e1df, green c8265f3 |
| 3 | `feature/icm-interfaces` | #116 / #115 | 300 | tree 363fac9, red 051a384, green c18a26a, docs 7313045, ABI refresh 6966ca1 and fix 5377567 |
| 4 | `feature/payment-state-lib` | #118 / #117 | 397 | tree aef5b5f, red 91409db, green 0d5e9e8 |

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 to 1.3 | `test/Probe.t.sol` | Unit | N/A (new) | Written, forge build fails (unresolved imports) | 2/2 pass | 2 cases (symbols, cancun) | Fmt and ordering only |
| 1.4, 1.5 | `scripts/check-policy.test.ts` | Unit | N/A (new) | Written, import fails | 30/30 pass | pins, layout, secrets, pragma, CLI | None needed |
| 1.6 | `scripts/export-abi.test.ts` | Unit | N/A (new) | Written, import fails | 8/8 pass | sorted keys, shared names, drift | Code-point sort (locale order failed) |
| 2.1 to 2.3 | `test/unit/Registry.t.sol` | Unit | N/A (new) | Written, build fails | 8/8 pass | 2 to 5 cases per leaf | Ordering only |
| 3.1, 3.2 | `test/unit/IcmInterfaces.t.sol`, `scripts/icm-interfaces.test.ts` | Unit | N/A (new) | Written, build fails | 5/5 and 6/6 pass | selector, swapped fields, round trip | None needed |
| 4.1 | `test/unit/PaymentStateLib.t.sol`, `test/unit/LaneParamsLib.t.sol` | Unit and fuzz | N/A (new) | Written, build fails | 8/8 pass | 25 and 16 pair oracles, 256 fuzz runs, mutation killed | Trimmed to the 400-line budget |

Totals: forge 23 tests, Vitest 44 tests in `packages/contracts`.

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|---|---|---|---|
| 1 | `forge test --match-path test/Probe.t.sol`: 2 passed; `forge config --json`: 0.8.30, cancun | forge build resolves all aliases | `packages/contracts/**`, workspace pins |
| 2 | `pnpm vitest run packages/contracts`: 38 passed | `pnpm contracts:policy` exits 1 on a dirty fixture, 0 on the package | scripts, CI job |
| 3 | `forge test --match-path 'test/unit/Registry*'`: 8 passed | reads the real `packages/chains/registry` | `script/lib/Registry.sol` |
| 4 | `forge test --match-path 'test/unit/Icm*'`: 5 passed | selector pins | `src/interfaces/external/icm`, docs |
| 5 | `forge test --match-path 'test/unit/{PaymentStateLib,LaneParamsLib}*'`: 8 passed | 25-pair and 16-pair exhaustive plus fuzz | `src/libraries`, `src/interfaces` |

## Deviations and notes

- PR 1b split in two: the ABI export became PR 1c (#112) because policy script, tests, CI and export reached 506 authored lines.
- pnpm needs two overrides (`@chainlink/contracts>@zksync/contracts` and `@chainlink/local>forge-std`, both removed with `-`) because `blockExoticSubdeps` rejects git-hosted subdependencies; `@arbitrum/nitro-contracts` build scripts are denied. The direct `forge-std` pin serves every import.
- Pins live in the pnpm catalog; `check-policy.ts` resolves `catalog:` references.
- `lintspec` 0.20.0 needs rustc 1.98 locally; the release binary (sha256 verified) was used. CI uses the pinned action.
- `vm.exists` is not `view` in forge-std v1.9.4, so the registry reader functions are non-view.
- PR 4 adds a minimal `ISettlementReceiver` (only the `Status` enum) so the typed receiver overload exists; PR 11 extends it.
- PR 3 added `src` files, so the ABI export must be regenerated from a clean build (`forge clean && forge build && pnpm contracts:abi`); stale local `out/` entries leaked once and were fixed with a follow-up commit (force-push was not allowed).
- O7 stays a human sign-off (stated in PR #116).
- solhint reports only ordering warnings (Bulloak scaffold puts modifiers between functions); no errors.

## Remaining

Superseded by the Batch 5 section: all 33 task rows are done.

## Batch 6: verify fixes

Closes the actionable warnings of `verify-report.md` (PASS WITH WARNINGS). Stacked from `feature/deploy-dry-run`, all PRs target `develop`.

| PR | Branch | Item | Commits | Authored lines |
|----|--------|------|---------|----------------|
| #170 (issue #169) | feature/deploy-owner-handoff | W1 | tree 5861bf8, red 04a6957, green 361a0b2 | about 137 |
| #172 (issue #171) | feature/hub-invariants-extended | W2 | handler 6a3214d, invariants 1acb74b | about 180 |
| #174 (issue #173) | feature/constructor-zero-checks | zero address suggestion | tree 06564ae, red babd749, green 437c1c1 | about 150 |

- W1: `DeployFuji` and `DeployL1` construct the hub, broker and receiver with the deployer, run the `onlyOwner` config as the deployer, then `transferOwnership(owner)` unless owner equals the deployer. Records hold `pendingOwner` (read from the hub or receiver, zero when none). README documents `acceptOwnership` and that verification args use the deployer. ADR 0010 notes the nonce prediction is unchanged (the offer follows the receiver deployment).
- W2: handler signs EIP-712 authorizations (key-backed payers), pays through delegates and races exits at the deadline. Invariants 2 (table edges from `StatusChanged` events, one per change), 4 (paid and refunded exits exclusive) and 5 (budget equals ghost budget). Non-vacuity by temporary mutations (budget not decremented, wrong emitted target, refund without deadline check, no transition guard), all caught and reverted. Deep profile 5/5 at 512 runs and depth 200.
- Zero checks: `PaymentBroker_ZeroAddress` for a zero hub, `SettlementReceiver_ZeroAddress` for the four receiver addresses; existing errors reused, ABI unchanged after a clean regenerate.
- Gotcha: `vm.getRecordedLogs` keeps logs of reverted calls, so the handler drops them after low-level probe calls.
- All checks green locally: fmt, clean build, forge test (226 pass, 1 skipped), gas snapshot, bulloak, lintspec, solhint (0 errors), policy, ABI no diff, typecheck, vitest 438, biome.

Carried to archive or later milestones: W3 (accepted spec delta, Fuji fork non-blocking in CI), W4 (viem getContract inference test), W5 (budget 0 reads Unauthorized), W6 (real ICTT semantics, T7.12 and M8), W7 (PR #134 and #158 have no tree commit), W8 (no authorizer-side nonce invalidation, budget replace race), and the remaining suggestions.
