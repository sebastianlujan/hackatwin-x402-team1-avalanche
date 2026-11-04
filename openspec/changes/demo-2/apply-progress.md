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

## Deferred (pending the user's approval to fetch `ava-labs/icm-services`)

- PR 1 (spike and fetch, tasks 1.1 to 1.6): not started; no external clone, download, build or execution was done.
- PR 1 will be inserted later in the queue, after the approval.

## Deviations and notes

- `WarpMessengerStub` defines its own `WarpMessage` struct and does not import an upstream `IWarpMessenger` (none exists under `src/interfaces/external/icm/`). Field layout `(bytes32 sourceChainID, address originSenderAddress, bytes payload)` and the `WarpMessageSent(bytes32 indexed messageID, bytes message)` event follow design D7; conformance with the upstream struct is verified by the PR 1 spike (PR 1 task 1.5).
- Task 4.2 `childEnv` for forge is deferred to the forge wrapper PR (no forge spawn exists in the repo yet).
- Task 5: the guarded client write does not yet pass `ContractCall.value` through to `writeContract`; it lands with the local sender (PR 11) where it is exercised. Wiring `createEventChannel({ simulated })` from the profile lands with the Demo 2 root (PR 15).
- The `contracts` CI job on #226 failed twice on a pre-existing probabilistic invariant (`InvariantPaymentHub`, "race never ran"), unrelated to the change; the same job passed on #228, #230 and #232 which contain the same code.
- Only anvil-free tests ran in this batch (scripted transports and fakes); no anvil or other process was started.
