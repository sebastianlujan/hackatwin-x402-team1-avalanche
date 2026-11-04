# Tasks: Demo 2 on a local cross-chain pair (M8 dev base)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | about 4,300 authored across 16 PRs (170 to 380 each, `pnpm-lock.yaml` excluded) |
| 400-line budget risk | Medium (PR 1, 10, 14, 15 forecast 300 to 380; each has a named seam) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (spike) then PR 2 to PR 16, one linear queue |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (PR 1 from `feature/web-verify-fixes` #222, each next from the previous, all target `develop`) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Gate: if the PR 1 spike shows all three Teleporter methods fail, STOP. Record that a spec change is needed (same non-canonical address on both chains) before PR 7. PRs 2 to 6 do not depend on the result.

### Suggested Work Units

| PR | Branch | Goal | Est. | Seam if over | Focused test | Rollback |
|----|--------|------|------|--------------|--------------|----------|
| 1 | `feature/demo-2-local-icm` | Spike, fetch script, license guard, PLAN note | 340 | docs vs script | `pnpm vitest run test/license-guard.test.ts` | revert; delete `.cache/icm-services` |
| 2 | `feature/warp-messenger-stub` | Stub and `LocalUsdc` | 280 | stub vs token | `forge test --match-path 'test/utils/*'` | test/utils files |
| 3 | `feature/local-chains` | Plain anvil, `LocalChain`, guards | 250 | none | `pnpm vitest run packages/chains` | `packages/chains` additions |
| 4 | `feature/local-crosschain-profile` | Profile, env keys | 250 | none | `pnpm vitest run packages/config` | config additions |
| 5 | `feature/simulated-labeling` | Marker, optional link, no replay | 250 | none | `pnpm vitest run packages/core packages/agent-kit apps/web/src/server` | optional fields |
| 6 | `feature/local-world-base` | anvils, git-safe fetch wrapper, `local` project | 300 | none | `pnpm vitest run e2e/protocol` | `e2e/protocol/src/local` |
| 7 | `feature/local-world-infra` | Stub, Teleporter, registry (steps 1 to 3) | 280 | none | `pnpm test:local -t world` | world infra files |
| 8 | `feature/icm-relay-simulator` | Relay and CI job | 290 | CI vs relay | `pnpm test:local -t relay` | `relay.ts`, CI job |
| 9 | `feature/local-world-contracts` | Steps 4 and 5 | 300 | none | `pnpm test:local -t world` | forge registry writer |
| 10 | `feature/local-crosschain-deploy` | Steps 6 and 7, `up` | 360 | scripts vs guards | `pnpm test:local -t deploy` | `forge.ts`, `up.ts` |
| 11 | `feature/ccip-sender-local` | T8.1 | 250 | none | `pnpm vitest run demos/02-l1-crosschain` | sender adapter |
| 12 | `feature/hop-tracker` | T8.2 | 300 | decode vs map | same | tracker |
| 13 | `feature/treasury-setup` | T8.3 | 250 | none | same | script |
| 14 | `feature/demo-2-module` | Module, tokens, deployment, labels, ICTT funding | 330 | none | same | module files |
| 15 | `feature/demo-2-payment-agent` | Root, banner, scan, demos doc | 340 | root vs docs | same | root, docs |
| 16 | `feature/e2e-crosschain-relay` | T8.5 | 300 | Rejected case | `pnpm test:local` | e2e tests |

Runtime harness: PRs 1, 6 to 16 run on two real anvils (PRs 2 to 5, 11 to 15 also have unit scope, N/A harness reason: fakes).

## PR 1: Spike and fetch (specs: local-crosschain-environment)

- [ ] 1.1 `.gitignore` add `.cache/`; `package.json` add `local:icm` (about 10 lines)
- [ ] 1.2 RED `test/license-guard.test.ts`: tracked file with `LicenseRef-Ecosystem` header fails, bare token allowed (License guard, Bare token allowed)
- [ ] 1.3 GREEN `git grep` guard in same file; `.cache/icm-services/<commit>/` fetch and build script at `34deb30f...` (Cache hit, Clean tree)
- [ ] 1.4 Spike `e2e/protocol/src/local/spike-teleporter.ts`: try A, B, C in order, assert address, code, round trip (Teleporter address, Round trip)
- [ ] 1.5 Verify and record: ICTT constructors and structs, `registerWithHome` fee struct, registered-remote view, Teleporter events, `IWarpMessenger` struct, solc, foundry root, submodules, linking; save to `openspec/changes/demo-2/spike.md`, tick the design Open Question
- [ ] 1.6 Apply the PLAN note to `docs/PLAN.md` (5.3, M8, T8.1 to T8.5)

## PR 2: Stub and token (Q21 order; specs: icm-relay-simulation)

- [ ] 2.1 Tree: `WarpMessengerStub.tree` and `LocalUsdc.tree`, scaffold via `bulloak scaffold` (Tree covers tests)
- [ ] 2.2 RED `packages/contracts/test/utils/WarpMessengerStub.t.sol` (Blockchain ID, Send recorded, Two sends, Injected message, Missing index, Overwrite); `LocalUsdc.t.sol` (6 decimals, mint)
- [ ] 2.3 GREEN `WarpMessengerStub.sol` (storage only, no immutables) and `LocalUsdc.sol`; `bulloak check` passes
- [ ] 2.4 Guard test: no `script/**` names `WarpMessengerStub` (No script deploys it)

## PR 3: Local chains (specs: local-crosschain-profile)

- [ ] 3.1 RED tests: forbidden chain ID refuses before spawn; non-loopback refuses before spawn; plain anvil args; reported ID 43113 on loopback refused; `txUrl` undefined (Forbidden ID, Wrong chain ID, Remote host, Local hash, Plain mode)
- [ ] 3.2 GREEN `packages/chains/src/{local,anvil,guarded-clients,explorer}.ts`: `LocalChain`, `shell: false` fixed args, `setCode` cheat (No explorer, Registry unchanged)

## PR 4: Profile (specs: config-profiles, local-crosschain-profile)

- [ ] 4.1 RED: five profiles (rename in tests and docs), Live keys ignored, Two bad values (one error naming both), No chain ID env key, Remote RPC, Live chain ID statics, Local profile loads, Env example
- [ ] 4.2 GREEN `packages/config/src/{env,profiles,load-profile}.ts`, `.env.example`, `childEnv` for forge; statics incl. shared `budget`

## PR 5: Labeling (specs: simulated-run-labeling, core-domain-ports)

- [ ] 5.1 RED: Marker round trip, absent, on the base, other value; Hop with and without link; Call with and without value; Stamped by the channel; Save refused, Real run saves; replay refuses marked lines
- [ ] 5.2 GREEN `packages/core/src/{domain/agent-event,ports/chain-client}.ts`, `packages/agent-kit/src/{runner/event-channel,recording/recording}.ts`, `apps/web/src/server/replay-source.ts`

## PR 6: World base (threat matrix: git selection, process spawn)

- [ ] 6.1 RED `e2e/protocol/src/local/icm-services.test.ts`: relative path refused; dir equal to project root refused; absolute accepted
- [ ] 6.2 GREEN `icm-services.ts` (`git -C <abs>`, `rev-parse --show-toplevel` check) and `anvils.ts` (probe loopback, chain IDs; Chain IDs scenario)
- [ ] 6.3 `vitest.config.ts` `local` project (serial), `package.json` `test:local` (No external inputs, Teardown)

## PR 7: World infra steps 1 to 3 (needs spike pass)

- [ ] 7.1 RED `world.local.test.ts`: stub at Warp address with blockchain ID, Teleporter address, Remote registered precursor
- [ ] 7.2 GREEN `world.ts`: stub `anvil_setCode`, `setBlockchainID`, promote spike winner to `teleporter.ts`, `TeleporterRegistry`

## PR 8: Relay and CI (specs: icm-relay-simulation, crosschain-protocol-e2e)

- [ ] 8.1 RED `relay.local.test.ts`: Hub to L1, L1 to hub, No double delivery, Delivery reverts report
- [ ] 8.2 GREEN `relay.ts` (D7: ID from `SendCrossChainMessage`, bytes from `WarpMessageSent`)
- [ ] 8.3 `.github/workflows/ci.yml` job `local` (cache, forge v1.5.1, empty `git status`, `ci-gate`); guard: no `--private-key` in workflows (CI job)

## PR 9: World contracts steps 4 and 5

- [ ] 9.1 RED: Registry untouched, Source key `local-ccip`, Remote registered
- [ ] 9.2 GREEN `world.ts` `LocalUsdc`, `CCIPLocalSimulator`, `ERC20TokenHome`/`Remote`, `registerWithHome`; `forge.ts` registry, params, deployments in `.cache/local-crosschain/<instance>/forge`; `packages/contracts/foundry.toml` `fs_permissions`

## PR 10: Deploy and dev command (specs: contracts-deployment)

- [ ] 10.1 RED: Both scripts succeed, No private key, Script diff (`src/` and `script/` unchanged), Local unlocked sender, Unlocked on a remote host
- [ ] 10.2 GREEN `forge.ts` `--unlocked --sender` after probe; steps 6 and 7; `world.json`, `local.env`; `up.ts`; `package.json` `demo2:local:up`

## PR 11: T8.1 sender (specs: crosschain-messaging-local)

- [ ] 11.1 RED `demos/02-l1-crosschain/adapters/sender.test.ts`: Happy path, Fee paid, Unsupported, Fake client, Unscripted call, Transport; no selector literal
- [ ] 11.2 GREEN `adapters/sender.ts`, `extraArgsV3`, `tokens.ts`

## PR 12: T8.2 tracker (specs: hop-tracking)

- [ ] 12.1 RED fixtures: Happy path, Rejected, ICTT failure, Broker rejection, Duplicate log, Local, Fuji, Resume, Unknown ID, Fixture replay
- [ ] 12.2 GREEN `adapters/tracker.ts` (decode, then map), `LogReader`, hop table indices

## PR 13: T8.3 setup (specs: demo-2-payment-flow)

- [ ] 13.1 RED: First run, Second run, Profile budget, Missing budget (names `budget.total`), Output
- [ ] 13.2 GREEN `scripts/setup.ts`, `deployment.ts` (`world.json` schema); budget probe D10

## PR 14: T8.4 module

- [ ] 14.1 RED: Registration only (no token resolved), Fund an L1 address
- [ ] 14.2 GREEN `module.ts`, `labels.ts`, `adapters/ictt-funding.ts`, `index.ts`

## PR 15: T8.4 root and docs

- [ ] 15.1 RED: One payment, No key, Run events, First line, Scan (`sepolia`, `ccip.chain.link`, `snowtrace`, `https://`), Commands exist
- [ ] 15.2 GREEN `root.ts`, `payment-agent/*.ts`, banner, `docs/demos.md`

## PR 16: T8.5 E2E

- [ ] 16.1 `demo-2.local.test.ts`: Hub, Receiver, One event per hop (`None`, `Pending`, `Dispatched`, `Received`, `Settled`), Full track
- [ ] 16.2 `Rejected` (Not allowlisted), Fallback balance, broker rejection, Resume
- [ ] 16.3 Scan in suite, Teardown (no anvil pid), Clean tree (`git status --porcelain` empty), no anvil left running

## PLAN Done-when mapping (docs/PLAN.md M8)

- T8.1: lane and fee check closes at 11.2; unit tests with fake client at 11.1; CCIP API status stays OPEN (needs the real testnet, D12)
- T8.2: resume 12.2; recorded logs 12.1; explorer links stay OPEN (local hops omit them, M6 closes)
- T8.3: idempotent, profile budget, prints lane `Id` and remaining: 13.2
- T8.4: trigger and track 15.2; ICTT funding 14.2; demos.md 15.2
- T8.5: real deploy scripts 10.2 asserted at 16.1; `Pending to Settled` 16.1; `Rejected` and fallback 16.2 (closed on the local pair only; T8.6 stays open)
