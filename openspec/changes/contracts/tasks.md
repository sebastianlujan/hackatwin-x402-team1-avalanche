# Tasks: Contracts (M7 code subset)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | about 5,300 authored across 18 PRs, 190 to 395 each (lockfile and generated ABIs excluded) |
| 400-line budget risk | High as a whole; Low to Medium per PR after the splits (watch PR 8 and PR 11) |
| Chained PRs recommended | Yes |
| Suggested split | 1a, 1b, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14a, 14b, 15, 16 |
| Delivery strategy | ask-on-risk, resolved by the standing preference: split anything over budget, no size:exception |
| Chain strategy | stacked-to-main (PR 1a branches from `feature/e2e-demo-1`, PR #106; each next from the previous; all target `develop`) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Re-forecast of the proposal slicing: PR 1 (340) is split into 1a (scaffold, probe, lint configs) and 1b (policy script, CI, ABI export) because the probe, ~12 config files, a TS script with tests, and the CI job together leave no margin. PR 14 (320) is split into 14a (simulator tests) and 14b (broker invariants) because the simulator setup is unknown until PR 13. PR 8 (390) and PR 11 (390) have no margin: if the Green commit pushes past 400, split at the named seam (8b = `dispatch`; 11b = reject path) instead of an exception.

Conventions for every Solidity PR (Q21), as separate commits: (a) `.tree` + `pnpm test:bulloak:scaffold` output, builds; (b) test bodies, `forge test` red; (c) implementation, green; (d) optional refactor. Each commit is a work unit (work-unit-commits). Every `.sol` starts `pragma solidity 0.8.30;`. Run `forge fmt`, `bulloak check`, lintspec, and solhint before each commit. No `--broadcast` anywhere.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundry scaffold, pins, probe | 1a, base `feature/e2e-demo-1` | `cd packages/contracts && forge build && forge test --match-path test/Probe.t.sol` | `forge config --json` shows 0.8.30, cancun | `packages/contracts/**`, workspace pins |
| 2 | Policy script, CI job, ABI export | 1b, base 1a | `pnpm vitest run packages/contracts` | `pnpm contracts:policy` on a dirty fixture fails | CI job and gate entry, scripts |
| 3 | Forge registry reader | 2, base 1b | `forge test --match-path 'test/unit/Registry*'` | read real `packages/chains/registry` | `script/lib/Registry.sol` |
| 4 | ICTT interfaces and ADR 0009 | 3 | `forge test --match-path 'test/unit/Icm*'` | selector pins | `src/interfaces/external/icm`, docs |
| 5 | State and lane libraries | 4 | `forge test --match-path 'test/unit/PaymentStateLib*'` | 256-pair fuzz | `src/libraries`, `IPaymentHub` |
| 6 | Hub lanes | 5 | `forge test --match-path 'test/unit/PaymentHub/Lanes*'` | N/A (unit) | hub lane code |
| 7 | Hub authorization | 6 | `forge test --match-path 'test/unit/PaymentHub/Auth*'` | ERC-1271 wallet double | auth code |
| 8 | pay and refund | 7 | `forge test --match-path 'test/unit/PaymentHub/{Pay,Refund}*'` | fee-on-transfer double | `pay`, `refund` |
| 9 | settle, withdraw, dispatch | 8 | `forge test --match-path 'test/unit/PaymentHub/{Settle,Dispatch,Withdraw}*'` | callback doubles | settle and dispatch code |
| 10 | Hub invariants | 9 | `forge test --match-path 'test/invariants/PaymentHub*'` | `FOUNDRY_PROFILE=deep` locally; nightly workflow | invariants, nightly workflow |
| 11 | IcttMessenger and ADR 0010 | 10 | `forge test --match-path 'test/unit/IcttMessenger*'` | hub to `TestTokenTransferrer` | messenger and test double |
| 12 | SettlementReceiver core | 11 | `forge test --match-path 'test/unit/SettlementReceiver/{Source,Settle,Reject}*'` | hub to receiver integration | receiver |
| 13 | Receiver withdrawals | 12 | `forge test --match-path 'test/{unit,invariants}/SettlementReceiver*'` | ghost handler | withdrawal code |
| 14 | PaymentBroker | 13 | `forge test --match-path 'test/unit/PaymentBroker*'` | direct router-pranked calls | broker |
| 15 | Broker simulator and invariants | 14a, 14b | `forge test --match-path 'test/integration/Broker*'` | `CCIPLocalSimulator` | tests only |
| 16 | Fuji deploy script, ADR 0011 | 15 | `forge test --match-path 'test/integration/DeployFuji*'` | `forge script DeployFuji --fork-url fuji` (dry-run) | `script/**`, registry TS |
| 17 | L1 deploy script | 16 | `forge test --match-path 'test/integration/DeployL1*'` | anvil with fixture registry | `DeployL1.s.sol`, README |

## Phase 1: Toolchain (PR 1a, ~220 lines; PR 1b, ~230 lines)

Spec: contracts-toolchain.

- [x] 1.1 (1a) Branch `feature/contracts-scaffold` from `feature/e2e-demo-1`. Create `packages/contracts/{foundry.toml,remappings.txt,package.json,.solhint.json,.lintspec.toml}` (0.8.30, cancun, Wonderland `[fmt]`, `allow_paths`, `fs_permissions`, `deep` profile); add exact pins to `pnpm-workspace.yaml`: OZ 5.7.0, CCIP 2.0.0, Chainlink Local 0.3.1, contracts 1.5.0, forge-std v1.9.4. Tests: Cancun is explicit; No submodules.
- [x] 1.2 (1a, RED) `test/Probe.t.sol` importing one symbol per dependency and both OZ aliases; `forge build` fails until pins resolve. Test: Probe proves remappings; fallback test-only compiler profile if CCIP pragma breaks.
- [x] 1.3 (1a, GREEN) Install pins via pnpm, fix remappings until the probe passes; add `README.md` with the bulloak 0.9.2 and lintspec 0.20.0 install lines. ~45 lines.
- [x] 1.4 (1b, RED) Vitest cases for `scripts/check-policy.ts`: floating version, `.gitmodules` or `lib/`, forbidden `.husky/` or `.github/` under the package, `--broadcast` and `--private-key` in files, credentialed URLs, missing pragma. Tests: Floating version rejected; Secrets absent; Root-only tooling.
- [x] 1.5 (1b, GREEN) Implement `scripts/check-policy.ts`; add `contracts:policy` script.
- [x] 1.6 (1b, RED then GREEN) `scripts/export-abi.ts` with a test for `as const` typed output and fully qualified names; export to `abi/generated/`, add the Biome exclusion in `biome.json`. Tests: Typed ABI; Drift check.
- [x] 1.7 (1b) `.github/workflows/ci.yml`: contracts path filter, job `contracts` (fmt check, build, test, `bulloak check` via `smol-ninja/bulloak-toolchain@d4e00e1d...`, lintspec via `beeb/lintspec@a9e8a943...`, solhint, policy, ABI drift), add to `ci-gate`. Tests: Gate requires the job; Untouched package.

## Phase 2: Registry reader and interfaces (PR 2, PR 3)

- [x] 2.1 (PR 2, tree, ~40 lines) `test/unit/Registry.tree` and scaffold. Spec: chain-registry.
- [x] 2.2 (PR 2, RED) Tests: Chain ID to key; Unknown chain ID (`Registry_UnknownChainId`); Address entry; Missing entry (`Registry_EntryNotFound`); Selector parse; Bad selector (`Registry_InvalidSelector`); Read-only access.
- [x] 2.3 (PR 2, GREEN) `script/lib/Registry.sol` (`CHAIN_REGISTRY_DIR` override, `keyOf` scan, digit-checked selector); tick the PLAN M4 PR 10 box (Deferred box). ~110 lines.
- [x] 3.1 (PR 3, tree and RED) `test/unit/IcmInterfaces.tree`; selector pin test, reordered-field case, ABI round trip. Spec: icm-interfaces.
- [x] 3.2 (PR 3, GREEN) `src/interfaces/external/icm/{IERC20SendAndCallReceiver,IERC20TokenTransferrer}.sol` (file-level `SendAndCallInput`), `PROVENANCE.md` with the upstream commit. Test: Nothing extra, Reference present.
- [x] 3.3 (PR 3) `docs/adr/0009-own-ictt-interfaces.md`; update `docs/PLAN.md` T7.2, `docs/standards/smart-contracts.md` §4, `docs/decisions.md` O7. Test: Docs updated.

## Phase 3: PaymentHub (PR 4 to PR 9)

Spec: payment-hub. Each PR is tree, RED, GREEN, per the conventions above.

- [x] 4.1 (PR 4, ~360) `IPaymentHub`, `PaymentStateLib` (`HUB_EDGES`, `RECEIVER_EDGES`, typed overloads), `LaneParamsLib.id`. RED: Only table edges pass; Fuzzed pairs (all 256); Lane id.
- [x] 5.1 (PR 5, ~260) `PaymentHub` skeleton: `Ownable2Step`, `enableMessenger`, `createLane`, `_transition` harness. RED: Single write path (Wrong from-state, One event per change); Owner enables; Non-owner; Two-step handover; Create local lane; Messenger not enabled; Invalid shapes.
- [x] 6.1 (PR 6, ~330) EIP-712 `setAuthorization` with `SignatureChecker` and `Nonces`; test ERC-1271 wallet in `test/utils`. RED: EOA signature; ERC-1271 wallet; Replay (`InvalidAccountNonce`); Expired and cross-domain.
- [x] 7.1 (PR 7 pay #124 and PR 7b refund #126, split at refund, ~380) `pay` (deadline check, budget cap, balance-delta escrow, `ReentrancyGuardTransient`) and `refund`. RED: Happy path; Budget cap; Self-pay needs no authorization; Unauthorized caller; Fee-on-transfer token; Every non-None from-state; Refund after deadline; Too early (including `==`); refund Wrong from-state.
- [x] 8.1 (PR 8 settle and withdraw #128, PR 8b callback #130; `IMessenger` moved to 8c) `IMessenger`, `IPaymentCallback`, `PaymentCallbackLib`; `settle` credits, `withdraw` pulls, gas-capped `try` callback. RED: settle Happy path, Wrong from-state, Wrong lane or late; Pull withdrawal; Failing callback; Starved callback refused; Reentrant callback.
- [x] 8.2 (PR 8c #132) `dispatch` with `forceApprove` and zero-allowance check. RED: Happy path; Wrong from-state; Messenger failure; Messenger leaves allowance (`AllowanceNotConsumed`); No refund after dispatch.
- [x] 9.1 (PR 9, ~280) `test/invariants/PaymentHubHandler.sol` with ghost accounting, several lanes and tokens, time warps, `fail_on_revert`, call-coverage asserts in `afterInvariant`; `.github/workflows/contracts-nightly.yml` (deep profile, depth 100); `test/gas` snapshot and `forge snapshot --check` in CI. Tests: Terminal absorbing; Conservation; Coverage not vacuous; Snapshot present. Deep profile.

## Phase 4: IcttMessenger and SettlementReceiver (PR 10 to PR 12)

- [x] 10.1 (PR 10, ~350) `test/utils/TestTokenTransferrer.sol` mirroring the allowance sweep; messenger tree and RED. Spec: ictt-messenger. Tests: Valid config; Invalid gas limits; Zero values; Non-hub caller; Foreign destination or token; Input fields; Exact approval, no residue; One event; Transferrer reverts.
- [x] 10.2 (PR 10, GREEN) `src/contracts/IcttMessenger.sol`; `docs/adr/0010-receiver-address-by-nonce-prediction.md`.
- [x] 11.1 (PR 11, ~390; seam 11b = reject path) `SettlementReceiver` checks 1 to 8, `StatusChanged`. Spec: settlement-receiver. RED: Valid source; Each mismatch (five named errors); Checks precede decoding; First delivery; Duplicate ID (`InvalidTransition`); Settled; Pull fails; Rejected, nothing pulled; Funds reach the fallback (hub to receiver via `TestTokenTransferrer`); Owner allows; Non-owner.
- [x] 12.1 (PR 12, ~260) `withdraw` with callback policy, `InsufficientCallbackGas`, receiver ghost handler. RED: Withdraw; Failing callback; Gas below the callback cap; Conservation; Gas bound.

## Phase 5: PaymentBroker (PR 13, PR 14a, PR 14b)

Spec: ccip-payment-broker.

- [x] 13.1 (PR 13, ~350) Tree and RED: Non-router caller; No public entry; Allowed pair; Pair not mixed; Removed pair; Matching payer; Foreign payer (`Rejected`, `PayerMismatch`, no revert); Rebinding is not retroactive; Duplicate; Independent messages; Tokens attached; Malformed data; Accept; Budget spent; Rejected is final; Dispatch fails after pay (`Accepted` plus `DispatchFailed`); Too little gas; Within the limit (gas snapshot).
- [x] 13.2 (PR 13, GREEN) `src/contracts/PaymentBroker.sol` (no `getCCVsAndFinalityConfig` override, `setAllowedSender(selector, sender, payer)`).
- [x] 14.1 (PR 14a, ~170) `test/integration/BrokerSimulator.t.sol` with `CCIPLocalSimulator`: accept, simulator reject (outer `ReceiverError`), duplicate. Tests: Simulator reject; Duplicate; Accept.
- [x] 14.2 (PR 14b, ~150) `test/invariants/PaymentBrokerHandler.sol`: payer binding, final statuses, zero broker balance, coverage asserts. Tests: Payer binding holds; Coverage not vacuous.

## Phase 6: Deployment (PR 15, PR 16)

Spec: contracts-deployment. Dry-run only; the broadcast gate stays closed.

- [ ] 15.1 (PR 15, ~340) Tree and RED: Fuji inputs; Missing fact; Missing parameter; Mainnet fork (`Deploy_UnsupportedChain`); Dry-run writes nothing; No raw keys; Serializer output; Gate closed outside broadcast; Permissions scoped; Fuji fork; No allowlist entry; Pair from params.
- [ ] 15.2 (PR 15, GREEN) `script/Deploy.sol`, `script/DeployFuji.s.sol`, `script/params/fuji.json`; optional `icm.*` fields in `packages/chains/src/registry.ts`; `docs/adr/0011-deploy-params-out-of-registry.md`.
- [ ] 16.1 (PR 16, ~300) RED: L1 not yet registered; Addresses agree; Nonce moved (`NonceMismatch`); Stale record; L1 on anvil; Fixture drift; Templates present.
- [ ] 16.2 (PR 16, GREEN) `script/DeployL1.s.sol`, `test/fixtures/` registry, `script/params/l1.json`; `contracts-dry-run` job in `ci.yml` and `ci-gate`; `README.md` verification templates (Snowtrace, Builder Hub verifier labeled unverified).

## Phase 7: Close-out (inside PR 16)

- [ ] 17.1 Tick the T7.1 to T7.8 and T7.10 Done-when boxes in `docs/PLAN.md`; record T7.9, T7.11, T7.12 as pending; confirm each PR stayed within 400 authored lines (Budget respected).
