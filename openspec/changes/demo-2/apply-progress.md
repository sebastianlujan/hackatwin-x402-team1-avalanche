# Apply progress: demo-2 (PLAN M8, local development base)

## Batch 1 (PR 2 to PR 5): done

Mode: Strict TDD (Solidity: Bulloak tree, red, green; TypeScript: tests in the same PR). Queue: one linear stack, every PR targets `develop`, first branch from `feature/web-verify-fixes` (#222).

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 2 | `feature/warp-messenger-stub` | #225 | #226 | c4ca540 | cb248f5 | 297 |
| 3 | `feature/local-chains` | #227 | #228 | 77b5016 | 58e0f86 | 314 |
| 4 | `feature/local-crosschain-profile` | #229 | #230 | 4931bca | 0ebc580 | 96 |
| 5 | `feature/simulated-labeling` | #231 | #232 | d666354 | 7a9fa2f | 178 |

Tasks 2.1 to 2.4, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2 are marked `[x]` in `tasks.md`.

## Batch 2 (PR 6): done

Queue reorder: PR 6 runs before PR 1 (no PR 1 content needed; `.gitignore` `.cache/` stays in task 1.1). Queue is now #232, PR 6 (#234), PR 1, PR 7.

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 6 | `feature/local-world-base` | #233 | #234 | cfbe910 | 89dc104 (+ fix 809078a) | about 216 |

Tasks 6.1 to 6.3 are marked `[x]`. CI green on #234 after one fix commit: the dependency rule R6 forbids `process.env` outside the loader, so the git wrapper uses a fixed environment instead of inheriting `PATH` and `HOME`.
Design choices: unit tests (`*.test.ts` in `e2e/protocol/src/local/`) run in the default project; real-anvil tests (`*.local.test.ts`) run in the serial `local` project via `pnpm test:local`. Local RPC ports are 18545 (hub, 31337) and 18546 (L1, 31338). Real anvils were started and killed in `anvils.local.test.ts`; none remain.
Environment note: pnpm 12.16.1 self-switch is broken locally (exec error -8); commands and the commit hook run with `npm_config_manage_package_manager_versions=false`.

## Batch 3 (PR 1): done

User approved the fetch ("dale") for `ava-labs/icm-services` at `34deb30f`. The spike gate passed: method A works.

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 1 | `feature/demo-2-local-icm` | #235 | #236 | c3463ef, e00df85, 85518a9 | bf86ebc, 0df8004 (+ fix b5e448d) | 399 |
| 7 | `feature/local-world-infra` | #237 | #238 | bb2f7cf | 5a525d1 | 160 |

Tasks 1.1 to 1.6 are marked `[x]`; the design Open Question is ticked; findings are in `spike.md`.
Deviations: the license guard test lives at `e2e/protocol/src/local/license-guard.test.ts` (default Vitest project, beside its module) instead of `test/license-guard.test.ts`; `runGit` is now exported from `icm-services.ts` so the guard can run in the project repo, where `gitIn` refuses the project root. The spike builds its clients through `createGuardedClients` (rule R9 forbids raw viem clients outside `packages/chains`). Method B is not implementable from the approved source (the v1.0.0 raw tx is a release asset, not in the clone); C was not needed.

Tasks 7.1 and 7.2 are marked `[x]`. Method A lives in `teleporter.ts`; the spike now reuses `deployInfra`. The registry precursor for Remote registered is `TeleporterRegistry` listing Teleporter as version 1 (the ICTT pair lands in PR 9).

## Batch 5 (PR 8): done

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 8 | `feature/icm-relay-simulator` | #239 | #240 | 4da2728, a28b985 | 90d3567, 89dac65 | about 287 added, 55 removed |

Tasks 8.1 to 8.3 are marked `[x]`. `relay.ts` exports `relayOnce`, `sendMessage`, `messageReceived`, and the Teleporter ABI and events; the spike round trip reuses them. CI job `local` passed on #240 in 1m16s (cache miss).
Notes: `waitForTransactionReceipt` does not throw on a reverted receipt, so delivery does a `simulateContract` dry run first (revert reason) and also checks the receipt status. The revert case uses `allowedRelayerAddresses` with another address, which makes Teleporter revert with "unauthorized relayer". The `local` job runs when `ts` or `contracts` paths change and builds `packages/contracts` (the stub artifact) before `pnpm test:local`.

## Batch 6 (PR 9): done

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 9 | `feature/local-world-contracts` | #241 | #242 | d539477 | ab1f5ed | about 353 added, 5 removed |

Tasks 9.1 and 9.2 are marked `[x]`. `world.ts` `deployContracts` deploys `LocalUsdc`, `CCIPLocalSimulator`, `ERC20TokenHome` (hub) and `ERC20TokenRemote` (L1) from `packages/contracts/out` and the cached ICTT build, relays `registerWithHome` with `relayOnce`, then `forge.ts` writes registry (`fuji`, `twinpay-l1`, `local-ccip`), params and deployments under `.cache/local-crosschain/<instance>/forge`. `foundry.toml` has one added read-write `fs_permissions` entry for `../../.cache/local-crosschain`. CI passed on #242 including `local`.
Notes: roles by `eth_accounts` index (1 Fuji deployer and owner, 2 L1 receiver deployer at nonce 0, 3 treasury as broker payer, 4 agent as broker sender, 5 merchant, 6 fallback); `accountAt` added to `teleporter.ts`. `world.ts` and `relay.ts` import each other (functions only, no top-level use), so the ESM cycle is safe. PR 10 still has to run the real scripts against these files.

## Batch 7 (PR 10, split by the scripts vs guards seam): done

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 10a guards | `feature/local-crosschain-deploy` | #243 | #245 | de8284e | 56c48a8, 379f4d0 | 233 added, 6 removed |
| 10b scripts | `feature/local-crosschain-up` | #244 | #246 | d447570 | 117cc6a | 254 added, 2 removed |

Tasks 10.1 and 10.2 are marked `[x]`. 10a: `forge.ts` `runForgeScript` (`--unlocked --sender` only after loopback check and `probeAnvil`, fixed argv, `shell: false`), `childEnv` in `load-profile.ts` (task 4.2 deferral closed; R6 allows only the loader), the script diff guard pinned to the queue start commit `3a5c8c4`, and it runs in the `local` project (full history; the shallow `test` job cannot see the base). CI passed on #245 and #246 including `local`. 10b: `deploy.ts` (steps 6 and 7), `up.ts`, `world.ts` returns `roles`, root `demo2:local:up`.
Notes: `origin/develop` is a single initial commit, so the script diff guard compares with `3a5c8c4` (parent of the first demo-2 commit) and must be dropped at archive. `up` refuses to start when a node already answers on the local RPC ports, leaves detached anvils running on success and kills them on failure.

## Deviations and notes

- `WarpMessengerStub` defines its own `WarpMessage` struct and does not import an upstream `IWarpMessenger` (none exists under `src/interfaces/external/icm/`). Field layout `(bytes32 sourceChainID, address originSenderAddress, bytes payload)` and the `WarpMessageSent(bytes32 indexed messageID, bytes message)` event follow design D7; conformance with the upstream struct is verified by the PR 1 spike (PR 1 task 1.5).
- Task 4.2 `childEnv` for forge landed with the forge wrapper PR (PR 10a), inside `load-profile.ts` because R6 allows `process.env` only there.
- Task 5: the guarded client write does not yet pass `ContractCall.value` through to `writeContract`; it lands with the local sender (PR 11) where it is exercised. Wiring `createEventChannel({ simulated })` from the profile lands with the Demo 2 root (PR 15).
- The `contracts` CI job on #226 failed twice on a pre-existing probabilistic invariant (`InvariantPaymentHub`, "race never ran"), unrelated to the change; the same job passed on #228, #230 and #232 which contain the same code.
- Only anvil-free tests ran in this batch (scripted transports and fakes); no anvil or other process was started.
