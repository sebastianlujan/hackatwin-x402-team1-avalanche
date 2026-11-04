# Apply progress: contracts (M7 code subset)

Mode: Strict TDD (forge test; Vitest for TypeScript). Store: hybrid. Chain: stacked-to-main, every PR targets `develop`.

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

Tasks 5.1 onward (PR 5 `feature/hub-lanes` and later). Next PR starts from `feature/payment-state-lib`.
