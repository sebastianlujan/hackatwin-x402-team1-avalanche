# Apply progress: demo-2 (PLAN M8, local development base)

## Batch 1 (PR 2 to PR 5): done

Mode: Strict TDD (Solidity: Bulloak tree, red, green; TypeScript: tests in the same PR). Queue: one linear stack, every PR targets `develop`, first branch from `feature/web-verify-fixes` (#222).

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 2 | `feature/warp-messenger-stub` | #225 | #226 | c4ca540 | cb248f5 | 297 |
| 3 | `feature/local-chains` | #227 | #228 | 77b5016 | see PR | 314 |
| 4 | `feature/local-crosschain-profile` | #229 | #230 | see PR | see PR | 96 |
| 5 | `feature/simulated-labeling` | #231 | #232 | d666354 | see PR | 178 |

Tasks 2.1 to 2.4, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2 are marked `[x]` in `tasks.md`.

## Deferred (pending the user's approval to fetch `ava-labs/icm-services`)

- PR 1 (spike and fetch, tasks 1.1 to 1.6): not started; no external clone, download, build or execution was done.
- PR 6 (git-safe fetch wrapper, anvils, `local` project, tasks 6.1 to 6.3): not started.
- Both will be inserted later in the queue, after the approval.

## Deviations and notes

- `WarpMessengerStub` defines its own `WarpMessage` struct and does not import an upstream `IWarpMessenger` (none exists under `src/interfaces/external/icm/`). Field layout `(bytes32 sourceChainID, address originSenderAddress, bytes payload)` and the `WarpMessageSent(bytes32 indexed messageID, bytes message)` event follow design D7; conformance with the upstream struct is verified by the PR 1 spike (5 of the spike list).
- Task 4.2 `childEnv` for forge is deferred to the forge wrapper PR (no forge spawn exists in the repo yet).
- Task 5: the guarded client write does not yet pass `ContractCall.value` through to `writeContract`; it lands with the local sender (PR 11) where it is exercised. Wiring `createEventChannel({ simulated })` from the profile lands with the Demo 2 root (PR 15).
- The `contracts` CI job on #226 failed twice on a pre-existing probabilistic invariant (`InvariantPaymentHub`, "race never ran"), unrelated to the change; the same job passed on #228, #230 and #232 which contain the same code.
- Only anvil-free tests ran in this batch (scripted transports and fakes); no anvil or other process was started.
