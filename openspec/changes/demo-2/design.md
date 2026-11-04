# Design: Demo 2 on a local cross-chain pair (M8 dev base)

## Technical Approach

B0: a dev-only world in `e2e/protocol/src/local/` starts two plain anvils, deploys infra from the pinned icm-services
clone, runs the unchanged deploy scripts, and relays ICM both ways. Demo 2 code reads the world manifest (`world.json`)
and never imports the world: R3 lets e2e import only `/module`. Labels come from the profile. Specs: `specs/` (8 new;
modified `config-profiles`, `core-domain-ports`, and `contracts-deployment`, which adds the loopback
`--unlocked --sender` exception). Out of this change: S8 (a real local Avalanche network), the T8.6 smoke, and the web
`/demo-2` screen.

## Names

| Item | Value |
|---|---|
| Profile | `local-crosschain`, statics `ccip: 'simulated'`, `hubChainId: 31337`, `l1ChainId: 31338`, and the shared treasury `budget` (`perPayment`, `total`) |
| Env keys | Only `LOCAL_HUB_RPC_URL` and `LOCAL_L1_RPC_URL`; live keys and chain ID variables are ignored |
| Loopback hosts | `localhost`, `127.0.0.1`, `::1`; any other host fails at load without echoing the value |
| Chain ID guard | The statics schema refuses 43113, 43114, 11155111; clients refuse an RPC whose reported ID differs from the static (a loopback RPC reporting 43113 is refused) |
| CLI first line | `SIMULATED (local-crosschain)` (agent, setup, `up`) |
| ICM source | `ava-labs/icm-services` at `34deb30f7ddb4e6fecfd1132b413d09570610851` in `.cache/icm-services/<commit>/` |

## Architecture Decisions

| # | Topic | Options (tradeoff) | Decision |
|---|---|---|---|
| D1 | World home | `demos/02/local` (R3 blocks e2e import); new package (boilerplate); `e2e/protocol` (PLAN 5.3 home) | `e2e/protocol/src/local/`. `pnpm demo2:local:up` runs it with the relay loop |
| D2 | Teleporter at `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` | A: impersonate the v1 deployer at nonce 0 and deploy pinned initcode; B: keyless raw tx (anvil may reject unprotected tx); C: deploy elsewhere, `anvil_setCode`, copy non-zero slots from `forge inspect storageLayout` | PR 1 spike decides. Proposed order A, B, C (the proposal listed keyless first; the result picks). Each asserts the address, code, and a relayed round trip |
| D3 | Infra deploy | forge script (stub under `script/`, `--broadcast` in policy scope); `forge create` (slow); viem | viem `deployContract` from `packages/contracts/out` and the clone's `out/`, anvil-unlocked JSON-RPC accounts |
| D4 | Script signer | `--private-key` (banned); keystores (secrets) | `--unlocked --sender`, spawned only after the loopback and anvil probe |
| D5 | Simulated marker | boolean; envelope field | `simulated?: 'local-crosschain'` on every `AgentEvent`, stamped by `createEventChannel({ simulated })` |
| D6 | Local chains | registry entries (breaks the six-chain rule) | `LocalChain` objects, `access: 'fork-only'`, no explorer; creation throws off loopback |
| D7 | Relay payload | re-encode the event struct | Teleporter `SendCrossChainMessage` gives ID and destination; the stub's `WarpMessageSent` in the same receipt gives exact bytes; skip when `messageReceived(id)` |
| D8 | Tracker logs | `logs` on the core port (spec change) | demo-local `LogReader` over `GuardedClients.public` |
| D9 | Never a replay | web only (no save path exists) | `encodeRecording`/`saveRecording` in `packages/agent-kit/src/recording/` throw on marked events before writing; web `replayEnvelopes` refuses marked lines |
| D10 | Remaining budget | storage slot (layout coupling) | `eth_call pay(lane, treasury, max, deadline)` from the broker, decode `PaymentHub_BudgetExceeded(remaining, …)` |
| D11 | Registry isolation | | Local forge registry lives in `.cache/local-crosschain/<instance>/forge/registry`. `chains:verify` and registry tests read only `listChains()`, fixture drift only `test/fixtures/registry` |
| D12 | Deferred | | T8.1 CCIP API status and T8.2 explorer links stay in M6; local hops omit `explorerUrl` |

## World Setup

Chain IDs 31337 (hub) and 31338 (L1). Blockchain IDs `keccak256('local-hub' | 'local-l1')`. Roles by `eth_accounts`
index: 0 infra and relayer, 1 Fuji deployer, 2 L1 receiver deployer (nonce 0), 3 treasury, 4 agent, 5 merchant, 6
fallback, 7 unlisted merchant.

1. Probe loopback, anvil, chain IDs; `pnpm local:icm` (cache hit or build).
2. Both chains: stub via `anvil_setCode` at the Warp address, then `setBlockchainID`.
3. Both: Teleporter (D2), `TeleporterRegistry([{1, teleporter}])`.
4. Hub: `LocalUsdc`, `CCIPLocalSimulator`, `ERC20TokenHome`. L1: `ERC20TokenRemote`, `registerWithHome`, relay.
5. Write forge `registry` (`fuji`, `twinpay-l1`, `local-ccip` with the selector read from `configuration()`),
   `params`, `deployments`.
6. `DeployFuji` then `DeployL1` (cwd `packages/contracts`); assert the messenger targets the receiver.
7. Mint treasury USDC; write `world.json` and `local.env`.

## Data Flow

    agent EOA -ccipSend-> CCIPLocalRouter -> PaymentBroker -> PaymentHub (Pending, Dispatched)
      -> IcttMessenger -> ERC20TokenHome -> Teleporter -> stub event
    relay -> L1 stub.setVerifiedMessage -> Teleporter.receiveCrossChainMessage
      -> ERC20TokenRemote -> SettlementReceiver (Received, Settled | Rejected)

| Hop | Source | Transport | Status |
|---|---|---|---|
| 0 | send tx, router `MessageExecuted` | local | None |
| 1 | hub `StatusChanged` | local | Pending |
| 2 | hub `StatusChanged` | ictt | Dispatched |
| 3 | receiver `StatusChanged` | icm | Received |
| 4 | receiver `StatusChanged` | icm | Settled or Rejected |
| 4 | ICTT `CallFailed` | ictt | Rejected |
| 4 | broker `MessageRejected` (payer mismatch or hub refusal), reason from the event | local | Rejected; hops 1 to 3 never emitted |

Each status appears at most once. Indices are fixed, so dedupe and resume skip indices at or below
`progress.last(messageId)`. `CallSucceeded` adds no hop. The L1 receipt is found through Teleporter
`ReceiveCrossChainMessage`, the same code real legs will use.

## File Changes

| Path | Action | What |
|---|---|---|
| `e2e/protocol/src/local/{icm-services,anvils,world,relay,forge,up}.ts` | Create | Fetch and build, world, relay, dev command |
| `e2e/protocol/src/**/*.local.test.ts` | Create | Relay, world, Demo 2 E2E |
| `packages/contracts/test/utils/{WarpMessengerStub,LocalUsdc}.sol` + trees, tests | Create | Stub (storage only, no immutables), 6-decimal token |
| `packages/contracts/foundry.toml` | Modify | `{ access = 'read-write', path = '../../.cache/local-crosschain' }` |
| `packages/chains/src/{local,anvil,guarded-clients,explorer}.ts` | Create/Modify | `LocalChain`, plain mode, `setCode` cheat, `txUrl` undefined |
| `packages/config/src/{env,profiles,load-profile}.ts`, `.env.example` | Modify | Profile, keys, `childEnv` for forge (R6) |
| `packages/core/src/{domain/agent-event,ports/chain-client}.ts` | Modify | Marker, optional `explorerUrl`, `ContractCall.value?` |
| `packages/agent-kit/src/{runner/event-channel,recording/recording}.ts` | Modify/Create | Stamping, recording guard |
| `apps/web/src/server/replay-source.ts` | Modify | Refuse marked lines |
| `demos/02-l1-crosschain/{index,module,root,tokens,deployment,labels}.ts` | Create | Module, root, `world.json` schema, banner, scan |
| `demos/02-l1-crosschain/adapters/*.ts` | Create | Local sender, extra args, tracker, ICTT funding |
| `demos/02-l1-crosschain/{scripts,payment-agent}/*.ts` | Create | T8.3, T8.4 |
| `test/license-guard.test.ts` | Create | `git grep` for the SPDX `LicenseRef-Ecosystem` header |
| `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml` | Modify | `local` project, scripts, job |
| `docs/PLAN.md`, `docs/demos.md` | Modify | Note, local steps |

## Interfaces

```ts
interface Base<T extends string> { readonly version: 1; readonly type: T; readonly at: number; readonly simulated?: 'local-crosschain' }
interface Hop { readonly explorerUrl?: string } // other fields unchanged
interface ContractCall { readonly value?: bigint } // other fields unchanged
interface LocalChain { readonly key: 'local-hub' | 'local-l1'; readonly chainId: number }
const extraArgsV3 = (gas: number) => encodePacked(['bytes4', 'uint32', 'bytes4', 'bytes7'], ['0xa69dd4aa', gas, '0x00000000', '0x00000000000000'])
```

Stub: `setBlockchainID`, `getBlockchainID`, `sendWarpMessage` (stores, emits `WarpMessageSent`),
`setVerifiedMessage(index, sourceChainID, originSender, payload)`, `getVerifiedWarpMessage(index)`. The setup validates
`profile.budget.total` before any transaction and fails naming `budget.total` when it is absent.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Solidity | Stub, `LocalUsdc` | Bulloak tree, red, green (Q21); `bulloak check` in the existing `contracts` job |
| Config | Five profiles (rename in tests and docs), "Live keys ignored", "Two bad values" (one error naming both), "No chain ID env key", remote RPC, statics refuse live IDs, profile budget, missing budget | Vitest default |
| Chains | Plain anvil args, forbidden ID before spawn, reported chain ID differs from the static (43113 on loopback) refused, remote host refused, `txUrl` undefined | Vitest default, scripted transport |
| Demo 2 unit | Sender order and fee, unsupported lane, tracker fixtures (happy, `Rejected`, `CallFailed`, broker rejection, duplicate, resume, unknown ID), setup idempotency, module registration only (no token resolved), banner, link scan, no selector literal | Vitest default, fakes |
| Labeling | Marker round trip, recording refusal, replay refusal | Vitest default |
| Repo guards | No `script/**` file names `WarpMessengerStub`; no `--private-key` in setup source or workflows; `src/` and `script/` unchanged against the base; license guard; demos doc commands exist in `package.json` | Vitest default |
| Local | Relay both ways, no double delivery, revert report, world, budget probe, happy, `Rejected` with fallback balance, resume, scan, teardown (no anvil pid remains), clean `git status` | Vitest `local`, serial, snapshot per test |

CI job `local` (filter: root, `packages/**`, `demos/02-*/**`, `e2e/protocol/**`): Foundry v1.5.1, cache
`.cache/icm-services` and `~/.svm` keyed by commit, forge version and script hash, then `forge build`, `pnpm local:icm`,
`pnpm test:local`, empty `git status --porcelain`. No secrets; 8 min warm, timeout 20; in `ci-gate`.

## Threat Matrix

| Boundary | Applicability | Design response | RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: nothing runs by extension | | |
| Git repository selection | Applicable: fetch runs beside the project repo | `git -C <absolute cache dir>`; refuse unless `rev-parse --show-toplevel` equals it | Relative path refused; dir resolving to the project root refused; absolute accepted |
| Commit, push, PR | N/A: no VCS automation | | |
| Process spawn | Applicable: anvil, forge, git | `shell: false`, fixed argument arrays, URLs never echoed | Non-loopback refuses before spawn; forbidden chain ID refuses before anvil |

## Migration / Rollout

No migration. The proposal's PR queue, with two moves: PR 5 ships the relay, world infra (steps 1 to 3), the `local`
project and the CI job; PR 6 keeps steps 4 to 7. The D2 spike lands in PR 1.

PLAN note (PR 1): **M8 order change (2026-11-04).** Option B waits on T6.7, so M8 first builds on option B0: two plain
anvils with `CCIPLocalSimulator` on the hub, Teleporter and the ICTT pair built from `ava-labs/icm-services` at the
PROVENANCE commit (fetched at test time into the gitignored `.cache/`, never committed, O7), the `WarpMessengerStub` in
`packages/contracts/test/utils/`, and the relay in `e2e/protocol/src/local/`. The local T8.1 adapter and T8.2 to T8.5
run on B0. The real CCIP sender, CCIP API status, hop explorer links, T8.6, and option B still wait on T7.12. B0 output
is labeled simulated and is never a stage demo or replay (C1, Q2).

## Open Questions

- [ ] PR 1 spike: Teleporter deployer, ICTT constructors, `registerWithHome` fee struct, `SendTokensInput`,
  registered-remote view, Teleporter events, `IWarpMessenger` struct, solc, foundry root, submodules, linking.
- [x] Spec wording (license guard on the SPDX header, `ContractCall.value`, ICTT and broker hop mapping, chain IDs as
  statics): resolved by the updated specs.
