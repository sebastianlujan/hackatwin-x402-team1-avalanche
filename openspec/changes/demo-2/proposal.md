# Proposal: Demo 2 on a local cross-chain pair (M8, development base)

## Intent

Every M8 task waits on T7.12, which waits on M6 (faucet AVAX). The user decided on 2026-11-04 that M8 is built on a
`local-crosschain` profile for development and E2E only. On stage, Demo 2 stays the real testnet run after M6, or a
replay of a real run. Success means the full Demo 2 path (agent → CCIP → broker → hub → ICTT → receiver) runs and is
tested on two local anvils with no secrets, RPCs, or funds, through the real deploy scripts, and no local output can
pass for a live run.

## Scope

### In Scope
- S1: local world. Two plain anvils, infra deploy, local registry, params, and deployments in gitignored dirs, and the
  unchanged `DeployFuji`/`DeployL1`.
- S2: `WarpMessengerStub` (Solidity, Q21) and a two-way TypeScript relay simulator.
- S3: `local-crosschain` profile, a loopback and anvil guard, local chain definitions, and simulated labeling.
- S4: local `CrossChainMessenger` adapter (the local variant of T8.1).
- S5: hop tracker (T8.2).
- S6: treasury setup (T8.3), plus the payment agent and `registerCrossChainModule`, including ICTT funding for Demo 3
  (T8.4).
- S7: the T8.5 E2E on the local pair, covering the happy path, `Rejected`, and the fallback recipient balance.
- The PLAN note below.

### Out of Scope
- Work that needs testnet funds or a live L1: M6, T6.7, T7.11, T7.12, the real CCIP sender of T8.1, CCIP API status,
  T8.6, and recordings (M12).
- Web `/demo-2` (T10.7).
- S8 (a real local Avalanche network). It moves to M6 because it de-risks T6.1 and T6.6, not M8. The exploration says
  avalanche-cli is in maintenance mode; this proposal did not verify that.
- Any change to `src/` contracts or to the deploy scripts.
- Showing any local run on stage (C1).

## Capabilities

### New Capabilities
- `local-crosschain-environment`: the anvil pair, the pinned ICM fetch and build, and the infra and contract deploy.
- `icm-relay-simulation`: the Warp stub and the relay.
- `local-crosschain-profile`: the profile, env keys, guard, and local chains.
- `simulated-run-labeling`: the simulated marker, no explorer links, and never a replay.
- `crosschain-messaging-local`: the local T8.1 adapter.
- `hop-tracking`: T8.2.
- `demo-2-payment-flow`: T8.3 and T8.4.
- `crosschain-protocol-e2e`: the local T8.5.

### Modified Capabilities
None (`openspec/specs/` is empty).

## Approach

This follows exploration approach A.

| Slice | How |
|---|---|
| ICM sources | A script clones `ava-labs/icm-services` at `34deb30f7ddb4e6fecfd1132b413d09570610851`, the PROVENANCE ABI commit, so our interfaces and the bytecode match. The clone goes to the repo-root `.cache/icm-services/<commit>/`, which is gitignored and outside `packages/contracts`, so the `contracts:policy` rules on lib/ and submodules still hold. The clone builds with its own foundry config. It is never committed and never imported by our foundry project. CI caches it by commit, and a check fails if any tracked file carries `LicenseRef-Ecosystem`. |
| S1 | A TypeScript setup starts two anvils (`--hardfork cancun`, distinct local chain IDs, never 43113, 43114, or 11155111). It places the stub at the Warp address and deploys a 6-decimal test USDC, `CCIPLocalSimulator` on the hub, Teleporter at its canonical address on both chains, `TeleporterRegistry`, and the ICTT home and remote, then relays `registerWithHome`. It writes the registry and params to a gitignored dir granted in `fs_permissions`. The scripts hardcode the `fuji` and `twinpay-l1` keys, but the source pair uses a `local-ccip` key: `selectorOf` reads any key. It then runs the real scripts with `--unlocked --sender` (never `--private-key`) and a fresh receiver deployer at nonce 0 (ADR 0010, ADR 0011). |
| S2 | The stub source lives in `packages/contracts/test/utils/` (tree, red, green) and no script deploys it. The relay reads Teleporter `SendCrossChainMessage`, injects the message into the destination stub, and calls `receiveCrossChainMessage`, in both directions. |
| S3 | New loopback keys `LOCAL_HUB_RPC_URL` and `LOCAL_L1_RPC_URL`, so no live-network variable points at a local node. Local chains have no explorer and are write-guarded like a fork through `createGuardedClients` (ADR 0007). |
| S4 | The agent EOA calls the local router: `isChainSupported`, `getFee`, then `ccipSend` with extraArgs V3 (C2). It returns the message ID. The adapter sits behind the port, so O5 can still choose a sender contract. |
| S5 | Maps the CCIP send (transport `local`), hub and receiver `StatusChanged`, and the ICTT call result to `hop` events. It resumes from a message ID. Unit tests replay logs recorded locally. |
| S6 | An idempotent lane, approval, and EIP-712 budget taken from the profile. The agent root runs on the shared runner, with a scripted plan in E2E (ADR 0008). |
| S7 | A Vitest `local` project and a PR CI job. They assert `Pending → Dispatched → Received → Settled` with one event per transition, and `Rejected` for a merchant that is not allowlisted, with the full amount at `fallbackRecipient`. |

**Simulated labeling (enforced by tests):**
- Events carry an explicit simulated marker (the shape is decided in design). The CLI's first line reads
  `SIMULATED (local-crosschain)`.
- `Hop.explorerUrl` becomes optional and stays absent for local chains. `txUrl` already refuses chains that are not
  read-write.
- Chainlink Local's selector is `16015286601757825753`, the same as Sepolia's (verified in `@chainlink/local@0.3.1`).
  Labels therefore come from the profile, never from a selector lookup.
- A test scans local output and events for `sepolia`, `ccip.chain.link`, `snowtrace`, and any `https://` link.
- Local runs are never written to `apps/web/recordings/`.

## PR slicing

Stacked PRs in one linear merge queue. PR 1 branches from `feature/web-verify-fixes` (#222), every PR targets
`develop`, and each stays at or under 400 authored lines.

| # | Branch | Content | Est. | Seam if over |
|---|---|---|---|---|
| 1 | `feature/demo-2-local-icm` | PLAN note, fetch/build script, gitignore, license check, spike notes | 250 | docs vs script |
| 2 | `feature/warp-messenger-stub` | Stub as tree, red, and green commits | 200 | none |
| 3 | `feature/local-chains` | Plain anvil mode, local chain definitions | 250 | none |
| 4 | `feature/local-crosschain-profile` | Profile, env keys, `.env.example`, labeling types | 250 | labeling vs profile |
| 5 | `feature/icm-relay-simulator` | Relay | 250 | none |
| 6 | `feature/local-crosschain-deploy` | S1 world | 380 | infra vs our contracts |
| 7 | `feature/ccip-sender-local` | T8.1 local | 250 | none |
| 8 | `feature/hop-tracker` | T8.2 | 300 | decode vs map |
| 9 | `feature/treasury-setup` | T8.3 | 250 | none |
| 10 | `feature/demo-2-payment-agent` | T8.4 | 380 | module vs root |
| 11 | `feature/e2e-crosschain-relay` | T8.5, CI job | 300 | `Rejected` case |

## Versions

| Item | Value | Status |
|---|---|---|
| Foundry (forge, anvil) | v1.5.1 | Verified (CI pin) |
| `@chainlink/local` | 0.3.1 | Verified (`node_modules`) |
| `@chainlink/contracts-ccip` | 2.0.0 | Verified (decisions) |
| solc, EVM | 0.8.30, cancun | Verified (`foundry.toml`) |
| Bulloak | 0.9.2 | Verified (CI pin) |
| Teleporter, Warp | `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf`, `0x0200000000000000000000000000000000000005` | Verified (decisions, PLAN Step 0) |
| icm-services commit | `34deb30f7ddb4e6fecfd1132b413d09570610851` | Verified as the ABI reference only. Its solc, submodules, Teleporter version, and ICTT constructors are unverified. |
| anvil accepting the keyless Teleporter deploy tx | not applicable | Unverified |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/chains/src` | Modified | Plain anvil mode, local chains |
| `packages/config/src` | Modified | Profile and env keys |
| `packages/core/src/domain/agent-event.ts` | Modified | Simulated marker, optional `explorerUrl` |
| `packages/contracts/test/utils`, `foundry.toml` | New/Modified | Stub, one `fs_permissions` entry |
| `demos/02-l1-crosschain` | New | Adapter, tracker, setup, agent, module |
| `e2e/protocol` | New | World, relay, E2E |
| `.github/workflows/ci.yml`, `vitest.config.ts`, `.gitignore` | Modified | `local` job and project, `.cache/` |
| `docs/PLAN.md`, `docs/demos.md` | Modified | PLAN note, local dev steps |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Teleporter at its canonical address on a bare anvil. The keyless tx may need unprotected-tx support, and `anvil_setCode` skips constructor storage. | High | Spike before PR 6. Prefer the keyless tx; otherwise use CREATE and copy code plus storage. Assert a round-trip message. |
| The Warp stub drifts from Teleporter at the pinned commit (struct, message index, origin-sender check). | Med | Write the stub against the fetched source; relay round-trip test. |
| ICTT constructors, `TeleporterRegistry`, and `registerWithHome` (known from memory only). | Med | Read the fetched source in PR 1; design records the exact arguments. |
| Drift from the real deploy flow: our setup deploys the infra, not T6.7. | Med | Unchanged scripts and registry reader. Fork option B and T8.6 remain the real checks. |
| Ecosystem License code is downloaded in CI before the O7 sign-off. | Med | Never committed; tracked-file check. The O7 owner confirms the "non-production testing" reading. |
| A local run is mistaken for a live one (selector equals Sepolia's). | Med | The labeling rules and tests above. |
| Fidelity gaps: no finality, fees, OffRamp, Warp signatures, TxAllowList (Q15), or relayer config (Q19). | Known | Documented; covered by M6 and T8.6. |
| CI time and the GitHub fetch. | Low | Cache by commit; path filters. |

## Rollback Plan

Every PR is additive: a new profile, env keys, files, a Vitest project, one CI job, one `fs_permissions` entry, and an
optional field. To roll back, revert PRs in reverse queue order and delete `.cache/icm-services`. Nothing in `src/` or
the deploy scripts changes, so the testnet path (T7.12, T8.6) is untouched. If O7 rules out the fetch, drop PR 1's
script and PR 6, keep S3 to S6 on unit tests, and wait for fork option B.

## Dependencies

- The contracts stack is in the web stack tip. The T5.8 runner is in the tree.
- Foundry v1.5.1.
- GitHub access for the fetch (Q9 allowlist).

## Decisions

Q2, Q7, Q14, Q15, Q19, Q20, Q21, C1, C2, O5, O7, ADR 0007 to ADR 0012.

## PLAN note (to apply in PR 1 to section 5.3, M8, and T8.1 to T8.5)

> **M8 order change (2026-11-04).** Option B waits on T6.7. M8 first builds on option B0: two plain anvils with
> `CCIPLocalSimulator` on the hub, Teleporter and the ICTT pair built from `ava-labs/icm-services` at the PROVENANCE
> commit, fetched at test time into a gitignored `.cache/` and never committed (O7), plus the Warp stub and the relay
> simulator. The local T8.1 adapter and T8.2 to T8.5 run on B0 and no longer wait on T7.12. The real CCIP sender, CCIP
> API status, T8.6, and fork option B still do. B0 output is labeled simulated, has no explorer links, and is never a
> stage demo or replay (C1, Q2). The stub source sits in `packages/contracts/test/utils/` so Q21 tooling covers it, and
> no script deploys it.

## Proposal question round (needs user review)

These questions sharpen the PRD. Answer, skip, or correct the framing.

1. Should developers run Demo 2 locally from the CLI (start, pay, watch hops), or is the pair for E2E only? Assumed:
   both, so the relay and world setup live in one dev-only module shared by the demo scripts and E2E.
2. O5 is open. May the local agent send from its EOA (no new contract, extraArgs encoded off-chain)? Assumed: yes.
3. Is the test-time icm-services fetch acceptable before the O7 sign-off? Assumed: yes, for dev and CI.
4. Must saving local runs as web replays be impossible, not only labeled? Assumed: yes.
5. Should S8 go under M6? Assumed: yes.

## Success Criteria

- [ ] `pnpm test:local` passes on two plain anvils with no secrets, RPCs, or funds, and the contracts are deployed by
  the unchanged scripts.
- [ ] It asserts `None → Pending → Dispatched` on the hub and `Received → Settled` on the receiver, one
  `StatusChanged` per transition, and `Rejected` with the full amount at `fallbackRecipient`.
- [ ] The scripted payment agent triggers and tracks one payment, and the tracker resumes from a message ID.
- [ ] Local output marks every run as simulated and contains no live explorer or CCIP Explorer link.
- [ ] No tracked file holds icm-services source, and `git status` is clean after a run.
- [ ] Each PR stays at or under 400 authored lines, and PR 2 carries tree, red, and green commits.
