# Apply progress: contracts (M7 code subset)

Mode: Strict TDD (forge test; Vitest for TypeScript). Store: hybrid. Chain: stacked-to-main, every PR targets `develop`.

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

Task 9.1 onward (PR 9 hub invariants). Next PR starts from `feature/hub-dispatch`.
