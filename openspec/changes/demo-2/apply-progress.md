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

## Batch 8 (PR 11): done

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 11 | `feature/ccip-sender-local` | #247 | #248 | d774163 | 448628e | 244 added, 1 removed |

Tasks 11.1 and 11.2 are marked `[x]`. `adapters/sender.ts` `LocalCcipSender` (checks `isChainSupported`, `getFee`, then `ccipSend` with `value` = fee; message ID from the router `MessageExecuted` event; `transport = 'local'`), `adapters/extra-args.ts` `extraArgsV3`, `tokens.ts`. The router ABI is a viem `parseAbi` human-readable ABI (IRouterClient is not in the generated `src/` ABIs). The carried item is closed: guarded `write` passes `ContractCall.value`.
Notes: `destinationChainId` maps to a selector through a `lanes` option; the message is data-only (amount travels in the payload). `track` throws until the hop tracker (PR 12). The demo package gained `@hackatwin/core` and `viem` dependencies and `types: ["node"]`. The lockfile is pnpm 12 format, so installs ran with the cached 12.16.1 binary.

## Batch 9 (PR 12, split by the decode vs map seam): done

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 12a decode | `feature/hop-decode` | #250 | #251 | 1cc4d22 | 1b3d1be | 341 added |
| 12b map | `feature/hop-tracker` | #249 | #252 | e3047af | 6b203ab | about 505 added, 111 of them the recorded JSON fixture |

Tasks 12.1 and 12.2 are marked `[x]`. 12a: `tracker-decode.ts` (`TrackedLog`, `LogReader`, `decodeLogs` with parseAbi event ABIs per contract role), `log-reader.ts` (`ClientLogReader`), `tracker.fixtures.ts` (log builders that encode like the node). 12b: `tracker.ts` (`HopTracker.track` yields hops, `events` yields `hop` agent events, `HopProgress` port with an in-memory default, `MessageNotFoundError`), `LocalCcipSender.track` delegates to an optional tracker.
Notes: the Rejected hop carries the broker reason through a `TrackedHop.reason` extension, so core `Hop` is unchanged. A CallFailed log has no payment ID, so it is matched by its recipient (the receiver). The Resume scenario is tested with hops 0 to 2 already emitted (indices are skipped at or below the recorded progress), since the spec wording (hops 0 and 1 emitted, then 3 and 4) would skip index 2. Fixtures are encoded from the event ABIs, not captured from a live anvil; PR 16 records real ones. The DispatchFailed broker event keeps Pending and stops there. One pass per `track` call; polling is a repeated call.

### Batch 10 (PR 13, T8.3 setup, split into 13a and 13b)

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 13a manifest | `feature/world-manifest` (from hop-tracker) | #255 | #256 | 5589a22 | 5b05ac3 | 72 added |
| 13b setup | `feature/treasury-setup` (stacked on world-manifest) | #253 | #254 | 10c0ef7 | 7c1e220 | 376 added |

Tasks 13.1 and 13.2 are marked `[x]`. The first cut was one 447-line PR; it was split on the manifest seam after the review gate. 13a: `deployment.ts` (zod `world.json` schema, `parseWorld`) and the catalog `zod` dep. 13b: `scripts/setup.ts`: `setupTreasury` over a small `TreasuryChain` port (read, write, revertData, signTypedData, blockTimestamp); the lane is the merchant role on the enabled messenger with the L1 blockchain ID; the hub allowance and the broker budget come from `profile.budget.total`. D10 probe: `eth_call pay(lane, treasury, max, deadline)` from the broker decodes `LaneNotFound` (create the lane), `Unauthorized` (no budget, sign it) or `BudgetExceeded(remaining, ...)` (leave it). `pnpm demo2:setup` runs it with `local.env`. The carried "broker approval" item is the hub allowance (the hub pulls the USDC) plus the signed budget for the broker. Checked by hand on a live `demo2:local:up` world: first run 3 transactions, second run none, lane `Id` and 5.000000 USDC unchanged.
Notes: anvil returns the revert data on the RPC error at the bottom of the cause chain, not as a viem `RawContractError`. An exhausted budget (remaining 0) is signed again by a later run. 13b adds workspace deps on chains and config.

### Batch 11 (PR 14, T8.4 module part)

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 14 | `feature/demo-2-module` (stacked on treasury-setup) | #257 | #258 | 7d3aa1c | d222831 | 259 added, 6 removed |

Tasks 14.1 and 14.2 are marked `[x]`. `module.ts` `registerCrossChainModule` registers `Router`, `Lanes` and `Funding` and resolves nothing (the root registers `World` and `Hub`). `adapters/ictt-funding.ts` `createIcttFunding.fund(recipient, amount)` approves the token home when the allowance is short and calls home `send(SendTokensInput, amount)` toward the remote from the treasury; the relay delivers it. `labels.ts` holds `BANNER` (setup imports it; the e2e copy in `up.ts` stays because a demo cannot import e2e). The `world.json` schema gained `home`, `remote` and `selector`. Lane shape from PR 13 is unchanged.
Notes: the L1 balance rise after relay is a `local` project check for PR 16; the unit test proves the approve and `send` calls. Commits need `npm_config_manage_package_manager_versions=false` and the pnpm 12.16.1 bin on PATH for the commit-msg hook.

### Batch 12 (PR 15, T8.4 root and docs, split into five PRs)

Forecast 340 for one PR; the real size was about 880 authored lines, so it was split up front on clean seams (tools, root, agent, relay loop, docs), each with its own issue and red and green commits, stacked from `feature/demo-2-module`.

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 15a tools | `feature/demo-2-payment-tools` | #259 | #260 | b26ca47 | 3a963c9 | 307 added, 15 removed (forecast 270) |
| 15b root | `feature/demo-2-root` | #261 | #262 | 863eb70, f1c5285 | 9ac0d78, 86a8a96, 8b87f6f | 206 added (forecast 180) |
| 15c agent | `feature/demo-2-payment-agent` | #263 | #264 | 7e88e76 | 26c0610 | 302 added, 23 removed (forecast 260) |
| 15d relay loop | `feature/local-relay-loop` | #265 | #266 | b8f5de2 | 5b25b13 | 202 added, 7 removed (forecast 170) |
| 15e docs | `feature/demo-2-docs` | #267 | #268 | 2c6b64f | 62e84fb | 66 added, 14 removed (forecast 130) |

Tasks 15.1 and 15.2 are marked `[x]`. 15a: `payment-agent/tools.ts` (`send_payment`: policy authorize, one message to the broker, second send refused; `track_payment`: polls the messenger, one `hop` event per new hop, ends on Settled, Rejected with the reason, or Refunded, fails with "is the relay running?" after the polls), `lane.ts` (`laneParams`, `laneIdOf`, `paymentPayload`; the setup script now imports them), `world.fixtures.ts`, and the `@hackatwin/agent-kit` workspace dep. 15b: `root.ts` `composeRoot` (profile, world manifest, guarded hub and L1 clients, registers `World`, `Hub`, the module, and `Ports.CrossChainMessenger` = `LocalCcipSender` with `HopTracker` over `ClientLogReader`, `explorerUrl: txUrl` from `@hackatwin/chains/registry`), `labels.ts` `simulatedOf(profile)` and `findLiveReferences`. 15c: `payment-agent/{entry,prompt,scripted-plan,format,main}.ts`, `index.ts` exports, `pnpm demo2`. 15d: `relay-loop.ts` `runRelayLoop`, `RelayCursor` and an optional cursor on `relayOnce`/`relayDirection`, `up.ts` main runs the loop and kills both anvils on SIGINT or SIGTERM. 15e: `docs/demos.md` local Demo 2 section, `test/demo-2-runbook.test.ts`, `test/runbook.ts` (shared with the Demo 1 runbook test).
Carried items closed: `createEventChannel({ simulated })` is built from the profile (`simulatedOf`); the root registers `Tokens.World` and `Tokens.Hub` before the module; the tracker `explorerUrl` is the real `txUrl` (local hops omit links; the sender's `tracker` option is wired); `demo2:local:up` runs the relay loop (design D1).
Notes: (1) The first live run exposed a bug the fakes could not: the sender's default 200000 gas made the broker revert with `InsufficientGas`, and 1000000 let `pay` pass but the ICTT `dispatch` ran out of gas (`DispatchFailed`, payment stuck in Pending). The root now passes 3000000 (red test `f1c5285`). (2) Checked by hand on a live world: `pnpm demo2:local:up`, `pnpm demo2:setup`, `pnpm demo2 --scripted` twice, both payments reached `Settled` (hops None, Pending, Dispatched, Received, Settled); Ctrl-C on `up` left no anvil. (3) The relay cursor keeps a failed message in range: it advances only when a pass has no failures. (4) `up` needs `pnpm local:icm` run once first. (5) A flaky `contracts` job on #260 ("retry never ran", the same invariant family as "race never ran") passed on one rerun.

### Batch 13 (PR 16, T8.5 E2E)

Forecast about 300 authored lines (design 300; seam "Rejected case" not needed). One PR, no split.

| Task PR | Branch | Issue | PR | Red | Green | Authored lines |
|---|---|---|---|---|---|---|
| 16 | `feature/e2e-crosschain-relay` (stacked on `feature/demo-2-docs`) | #269 | #270 | aea68f6 (root progress unit test) | e84f47c (root progress option, module entry), 0984bcf (E2E suite) | 320 added, 2 removed (pnpm-lock excluded) |

Tasks 16.1 to 16.3 are marked `[x]`; all demo-2 tasks are done. `demo-2.local.test.ts` runs `up()` with a recording forge runner (asserts `DeployFuji` then `DeployL1` ran), sets up the treasury for the listed and an unlisted merchant, and runs 13 checks: Hub (`0->1`, `1->3` once each), Receiver (`0->1`, `1->2` once each, credit rose by the amount), One event per hop (indices 0 to 4), Full track (scripted agent, `simulated` on every event, no explorer link), Rejected (receiver `1->3`, hops through 4 `Rejected`, banner first), Fallback balance (fallback rose by the full amount, unlisted credit unchanged), Broker rejection (hops 0 and 4 with a 4-byte reason), Resume (hops 0 to 2, then a restarted root with stored progress emits only 3 and 4 after the relay), ICTT funding (recipient L1 balance rose by the amount, so `REQUIRED_GAS_LIMIT` 250000 and fee 0 hold), Scan, Teardown (pids dead, ports closed), Clean tree (`git status --porcelain` equals the value before the run). A background `runRelayLoop` (200 ms) runs beside the agent, as `demo2:local:up` does.
Product change: `composeRoot` takes an optional `progress` (HopProgress) so a restarted tracker resumes; the demo `package.json` export `./module` now points at `index.ts` (as Demo 1), which gained `HopProgress`, `laneIdOf`, `paymentPayload`, `setupTreasury`, `treasuryChain`; `e2e/protocol` has a workspace dependency on the demo (R3 allows `/module`). No product bug surfaced: all 13 checks passed on the first live run.
Risks closed: (b) ICTT funding proven on the live pair. (a) The tracker decodes live logs from the real contracts on every scenario (all five hops, `Rejected`, broker `MessageRejected`), so the ABI strings match real events; the encoded unit fixtures remain as unit data, no recorded-log file was committed.
Notes: (1) The Clean tree check compares with the status before the run (empty in CI, where the workflow also checks it); committing during a local run makes it fail, which shows it bites. (2) One local full run hung 300 s in `deploy.local.test.ts` `up()` on a stuck `forge script DeployFuji` (killed by PID; the same file passed alone and in the next full run); not reproduced, watch for it. (3) `local` job 1m31s on #270.

## Verify remediation C1

Verify finding C1 (simulated-run-labeling "Selector lookup banned" untested) and W7 ("Same selector" indirect) closed by one guard test. Issue #271, PR #272 (`feature/labels-selector-guard`, stacked on #270, target develop), commit 5e640df, 32 added lines in `demos/02-l1-crosschain/labels.test.ts`, CI all green. The test reads `labels.ts`, `root.ts` and `payment-agent/*.ts` (non-test) and asserts no `16015286601757825753`, no `sepolia` (labels.ts excepted: its live-reference deny-list regex names it) and no selector-to-name lookup; a second test labels a profile with the Sepolia-equal selector and asserts no Sepolia. Each was proven RED by a temporary local break (selector literal in root.ts, `chainNameBySelector` in labels.ts, Sepolia comment in format.ts, `simulatedOf` returning Sepolia), then reverted. Verdict becomes PASS WITH WARNINGS once #272 merges.

## Deviations and notes

- `WarpMessengerStub` defines its own `WarpMessage` struct and does not import an upstream `IWarpMessenger` (none exists under `src/interfaces/external/icm/`). Field layout `(bytes32 sourceChainID, address originSenderAddress, bytes payload)` and the `WarpMessageSent(bytes32 indexed messageID, bytes message)` event follow design D7; conformance with the upstream struct is verified by the PR 1 spike (PR 1 task 1.5).
- Task 4.2 `childEnv` for forge landed with the forge wrapper PR (PR 10a), inside `load-profile.ts` because R6 allows `process.env` only there.
- Task 5: the guarded client write `ContractCall.value` passthrough landed in PR 11 (#248). Wiring `createEventChannel({ simulated })` from the profile landed with the Demo 2 root (PR 15b, #262).
- The `contracts` CI job on #226 failed twice on a pre-existing probabilistic invariant (`InvariantPaymentHub`, "race never ran"), unrelated to the change; the same job passed on #228, #230 and #232 which contain the same code.
- Only anvil-free tests ran in this batch (scripted transports and fakes); no anvil or other process was started.
