# Proposal: Contracts (M7, code subset)

## Intent

Demos 2 and 3 need the on-chain core from Q1: `PaymentHub`, `IcttMessenger`, and `PaymentBroker` on Fuji, and
`SettlementReceiver` on TwinPay L1 (Q7, Q13, Q14). `packages/contracts` is an empty placeholder, and the forge
registry reader (M4 PR 10) is blocked until a Foundry project exists. Success: every contract is built test-first
(Q21) to the standards and is green in CI, and the deploy scripts dry-run from the shared registry without
broadcasting.

## Scope

### In Scope

- T7.1: Foundry scaffold following the Wonderland `dev` conventions (commit `504ada8`), with root-only hooks and CI gates.
- M4 PR 10: the forge registry reader.
- T7.2, done as our own minimal MIT ICTT interfaces instead of vendored files (pending O7).
- T7.3 to T7.8, every Done-when box.
- T7.10: deploy scripts, dry-run only.

### Out of Scope

- T7.9 (O5 is open), T7.11 (needs the L1, T6.4), and T7.12 (needs funds and a human reviewer).
- Any `--broadcast` or mainnet write (C1), fork tests against the real ICTT contracts (after M6), TypeScript
  consumers (M8), and the lane and treasury scripts in `demos/02`.

## Capabilities

### New Capabilities

- `contracts-toolchain`: the Foundry project, pinned dependencies and remappings, CI gates, and ABI export.
- `icm-interfaces`: minimal ICTT interfaces with pinned selectors.
- `payment-hub`: the state table, lanes, signed authorization, transitions, escrow, callbacks, and invariants.
- `ictt-messenger`: the hub plug-in that builds `SendAndCallInput`.
- `settlement-receiver`: L1 source validation, settle or reject, and merchant withdrawals.
- `ccip-payment-broker`: turns allowlisted CCIP messages into hub payments.
- `contracts-deployment`: registry-driven scripts, dry-runs, and deployment records.

### Modified Capabilities

- `chain-registry` (from shared-packages, not yet archived): adds the Foundry reader. It maps `block.chainid` to a
  registry key, parses the string CCIP selector into a `uint64`, and reverts with a named error when an entry is missing.

## Approach and PR slicing

The chain is stacked from `feature/e2e-demo-1`, and every PR targets `develop`. Each PR stays within 400 authored lines
(the lockfile and generated ABIs are not counted), with no `size:exception`. Each contract PR puts the `.tree`, the
failing test, and the implementation in separate commits, so the PR's commit list shows the Q21 order before the
squash merge.

| PR | Branch | Approach | Est. |
|---|---|---|---|
| 1 | `feature/contracts-scaffold` | T7.1: `0.8.30` with `evm_version = 'cancun'`. Standards §4 pins plus one `forge-std` tag, all through pnpm. A test-only probe imports every dependency, so `forge build` proves the remappings. A `contracts` CI job (fmt check, build, test, bulloak check, lintspec, solhint) joins `ci-gate`. ABIs export as `as const` with a drift check | 340 |
| 2 | `feature/chain-registry-forge` | Script library over `vm.parseJson`, with read-only `fs_permissions` | 200 |
| 3 | `feature/icm-interfaces` | T7.2: `IERC20SendAndCallReceiver`, a transferrer with only `sendAndCall`, and `SendAndCallInput`, written from the documented ABI. The upstream commit is recorded as the reference. A test pins the selectors. PLAN and standards §4 are updated | 120 |
| 4 | `feature/payment-state-lib` | T7.3: `IPaymentHub`, the `PaymentStateLib` bitmask, and `LaneParamsLib`. A fuzz test covers every `(from, to)` pair | 360 |
| 5 | `feature/hub-lanes` | T7.4: `Ownable2Step`, `enableMessenger`, and permissionless `createLane` | 260 |
| 6 | `feature/hub-authorization` | T7.4: EIP-712 with `SignatureChecker` and `Nonces`, plus an ERC-1271 test wallet | 330 |
| 7 | `feature/hub-pay-refund` | T7.5: `_transition`, `pay` with the budget cap and balance-delta escrow, and permissionless `refund` after the deadline | 380 |
| 8 | `feature/hub-settle-dispatch` | T7.5: `IMessenger`. `settle` credits the merchant, who withdraws later (pull), then runs a gas-capped `try` callback. `dispatch` grants the messenger an exact approval | 390 |
| 9 | `feature/hub-invariants` | T7.5: handler with ghost accounting and time warps, plus a deep nightly profile | 280 |
| 10 | `feature/ictt-messenger` | T7.6: only the hub can call `send`. Rejects a lane whose destination is not its own blockchain ID. Its test transferrer mirrors the allowance sweep | 350 |
| 11 | `feature/settlement-receiver` | T7.7: checks the caller, source chain, transferrer, sender, and token first, then records `Received → Settled` or `Rejected` | 390 |
| 12 | `feature/receiver-withdrawals` | T7.7: merchant withdrawal, the callback policy, and invariants | 260 |
| 13 | `feature/ccip-payment-broker` | T7.8: router as a constructor argument, a source-and-sender allowlist checked as a pair and bound to exactly one payer (a payload `onBehalf` that differs is recorded `Rejected`, no revert), and a message-ID guard. `_ccipReceive` calls `pay`, then `dispatch` | 350 |
| 14 | `feature/broker-local-simulator` | T7.8: `CCIPLocalSimulator` tests for accept, reject (outer `ReceiverError`), and duplicate, plus broker invariants (payer binding, final statuses, zero broker balance) | 320 |
| 15 | `feature/contracts-deploy-fuji` | T7.10: hub, broker, and messenger, deployed with `--account`. Deployment JSON is written only when broadcasting. Dry-run on a Fuji fork | 340 |
| 16 | `feature/contracts-deploy-l1` | T7.10: the receiver. The L1 dry-run uses anvil with a fixture registry, because the L1 does not exist yet. Asserts the cross-chain addresses. Verify templates: Snowtrace, and the Builder Hub verifier (unverified) | 300 |

If O7 is late, PR 3 can move to anywhere before PR 10. Test doubles (the transferrer and the ERC-1271 wallet) stay in
unit tests, as C1 allows.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/contracts/**` | New | `foundry.toml`, remappings, `src`, `test`, `script`, `abi` |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `packages/contracts/package.json` | Modified | Exact pins |
| `.github/workflows/ci.yml` | Modified | Contracts filter, job, and gate entry |
| `packages/chains/deployments/` | New | Written only when broadcasting |
| `docs/PLAN.md` (T7.2, T7.10), `docs/standards/smart-contracts.md` §4, `docs/decisions.md` (O7) | Modified | Own interfaces; L1 dry-run on anvil |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| OZ 5.7, 5.3, and 4.8.3 coexist: each version has its own `IERC20` type, and artifact names repeat | Med | Probe in PR 1; cast through `address` where the versions meet; fully qualified names in the ABI export |
| CCIP 2.0 needs solc 0.8.24 or later. A dependency with an exact older pragma breaks the single `0.8.30` build | Med | The PR 1 probe runs before any contract. Fallback: a separate compiler profile for tests only |
| solc 0.8.30 defaults to `prague`, which Avalanche lacks | Low | Set `cancun` explicitly; reuse the same settings for verification |
| CCIP 2.0: the V2 receiver checks finality; V3 extraArgs are built only by senders (T7.9) | Low | Keep the default full-finality `getCCVsAndFinalityConfig`. Simulator tests assert the outer error, direct tests the inner one |
| ICTT `sendAndCall`: our interfaces could drift in struct order or selector; USDC has 6 decimals and the remote may scale amounts; gas limits | Med | Selector pin test. The receiver trusts the delivered `amount`, and the payload carries no raw home-chain amounts. The messenger's constructor validates the gas limits. Fork test after M6 |
| Constructor cycle: the messenger needs the receiver's address and the receiver needs the messenger's | High | Design chooses between nonce prediction asserted before broadcast and CREATE3 |
| Shallow invariants that pass trivially | Med | Ghost accounting, several lanes and tokens, call-coverage asserts, nightly depth |
| Gas: `pay` plus `dispatch` must fit the CCIP `gasLimit`, and settlement must fit `recipientGasLimit` | Med | `forge snapshot` of both paths, a capped callback, required gas documented for M8 |
| The L1 has no chain ID or ICTT addresses yet | High | Scripts fail fast on missing entries; anvil fixture now, a real L1 dry-run in T7.12 |

## Rollback Plan

Each PR is one squash commit; revert the newest first. Nothing is broadcast, so there is no on-chain state to undo.
Nothing consumes the contracts before M8. Reverting PR 1 removes the CI job and its gate entry together, and the PR 3
doc edits revert with PR 3.

## Dependencies

- The M4 stack through PR #106 (`feature/e2e-demo-1`). O7 for PR 3. Forge `v1.5.1` (already pinned in CI).
- Decisions: Q1, Q5, Q7, Q13, Q14, Q15, Q19, Q20, Q21, C1, C2, C4, C5, O5, O7.

## Success Criteria

- [ ] CI runs fmt check, build, test, bulloak check, lintspec, and solhint on every PR, and `ci-gate` requires them.
- [ ] Every contract PR's commits show the tree, then a red test, then green.
- [ ] Only table edges pass `canTransition`. The invariants hold: terminal states absorb, only table edges occur, escrow is conserved.
- [ ] `CCIPLocalSimulator` tests cover accept, reject, and duplicate. A rejected L1 payment reaches `fallbackRecipient`.
- [ ] The scripts dry-run from the registry. Nothing in `src/` is hardcoded, and nothing is broadcast.
- [ ] Every PR stays within 400 authored lines.

## Proposal question round (pending user review; not asked, auto mode)

1. **Receiver rejection rule.** Which payments should the L1 record as `Rejected` instead of settling? Assumed: a
   merchant allowlist that the receiver's owner manages, so an unknown merchant is `Rejected`. A bad source or a
   duplicate payment ID reverts, and ICTT sends everything to `fallbackRecipient`.
2. **Broker failure.** When the hub refuses a relayed payment (budget spent, signature expired), should it be recorded
   as rejected on Fuji (final and visible) or revert (retryable after a top-up)? Assumed: recorded and final.
3. **Refund and budget.** Does a refunded payment give the agent its budget back? Assumed: no. The budget is a lifetime
   cap, and `settle` and `dispatch` are permissionless before the deadline, `refund` only after it.
4. **Rejected funds.** One `fallbackRecipient` per messenger (the demo agent's L1 wallet), or one per payer? Assumed:
   one per deployment, documented as a demo limit.
5. **O7.** Are our own MIT interfaces, written from the documented ABI, acceptable instead of vendoring files under
   the Ecosystem License? This needs a human sign-off and is not legal advice. If not, PR 3 vendors the files with
   the license, as PLAN says.
