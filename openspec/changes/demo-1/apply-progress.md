# Apply progress: demo-1 (M5), batch 1 (PRs 1, 2a, 2b, 3)

Mode: Standard (strict TDD does not apply). Chain: stacked, every PR targets `develop`, review budget 400 authored lines (lockfile excluded). No `size:exception`.

## Completed tasks

- [x] 1.1, 1.2, 1.3 (PR 1). ADR 0008 deliberately left out (belongs to the scripted-LLM PR).
- [x] 2.1, 2.2, 2.3 (PR 2a). `cheats()` split into the next PR to stay under 400.
- [x] 2.4, 2.5, 2.6 (PR 2b, split into three PRs).
- [x] 3.1, 3.2, 3.3 (PR 3, split into two PRs).

## PRs (all base `develop`, stacked in this order)

| Seq | PR | Branch | Issue | Authored lines | Scope |
|---|---|---|---|---|---|
| 1 | #64 | `feature/demo-1-config` | #63 | about 170 | `{ llm }`, `KEYSTORE_DIR`, `CCHAIN_FORK_BLOCK`, `run.started.llm`, catalog pins |
| 2 | #66 | `feature/guarded-sdk-clients` | #65 | 382 | `createGuardedClients` (public, wallet, chainClient), R9, ADR 0007 |
| 3 | #68 | `feature/demo-1-anvil` | #67 | 272 | `cheats()`, `anvilArgs`, `startAnvil` |
| 4 | #70 | `feature/demo-1-keystores` | #69 | 200 | `encryptKeystore`, `state.ts`, `keystoreNamedInEnv` |
| 5 | #72 | `feature/demo-1-fork-scripts` | #71 | 235 | `pnpm demo1:fork`, `demo1:fork-block`, `fork` Vitest project, CI `fork` job |
| 6 | #75 | `feature/demo-1-funding` | #74 | 295 | `fund`, `createFundingChain`, `fileState`, demo env RPC defaults |
| 7 | #76 | `feature/demo-1-fund` | #73 | 282 | `module.ts`, `tokens.ts`, `pnpm demo1:fund`, fork test, `cacheTime: 0` fix |

All seven PRs: CI green (including the new `fork` job on #72, #75, #76).

## Work Unit Evidence (per PR)

| Evidence | Value |
|---|---|
| Focused tests | `pnpm vitest run packages/config packages/core` (118), `packages/chains test/dependency-rule`, `packages/chains` (53/56/...), `demos/01-x402-twin` (11 to 22); `pnpm test` ends at 263 tests green, `pnpm lint` clean, `pnpm typecheck` clean |
| Runtime harness | `pnpm test:fork` 5 tests green; live `pnpm demo1:fork` (anvil at 99388000, chain 43114, rerun no-op), `pnpm demo1:fund` twice (below) |
| Rollback boundary | per PR, see each PR body |

## Live fork funding evidence (fresh anvil at block 99388000, loopback only)

- Run 1: gas topped up for 4 addresses; minted 16583.645864138479263121 ARGt; approved the same amount.
- Run 2: gas topped up for 0; minted 0; allowance already set.
- `cast`: agent ARGt `balanceOf` = 16583645864138479263121; `allowance(agent, Permit2)` = 16583645864138479263121 (equals T); gas about 10 AVAX for agent, seller, facilitator, adapter.
- Roles: agent 0x7Ea1e5EF86548a506C81085099b356fD0B7B9EFC, seller 0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5, facilitator 0x32cA50A7e70e0894BF557F6E8fB934e89A0Ac164 (throwaway keystores in gitignored `.demo1/`).

## Deviations from design

- PR 2 became four PRs (2a, anvil, keystores, fork scripts) and PR 3 two (funding, module and script) to stay under 400 lines; `cheats()` lives in the anvil PR, not 2a.
- `N` (`CCHAIN_FORK_BLOCK`) = 99_388_000; the public RPC serves it.
- `demo1.env` also writes the three public read RPC defaults (the `cchain-fork` profile requires them).
- `keystoreNamedInEnv` added to the config loader so scripts never read `process.env` (R6).
- Role keystores that env names keep the user's; our own `demo1.env` entries are kept on rerun when the file exists.
- Bug fixed in PR 3b: viem cached head made reads after writes stale; `getBlockNumber({ cacheTime: 0 })`.
- Tokens for Registration, FacilitatorApp, SellerApp, Buyer, Balances are typed `unknown` until their PR.

## Remaining

Tasks 4.1 onward (PRs 4 to 13). ADR 0008 and its README row are uncommitted in the working tree, for the scripted-LLM PR.
