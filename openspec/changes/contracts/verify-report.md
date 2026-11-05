```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:af25bbf02acd8180cb9944b62d598d26065942a99500b2f207663925aa01ec1b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 51/51
scenarios: 133/133
test_command: cd packages/contracts && forge test
test_exit_code: 0
test_output_hash: sha256:e8eb59e6b45750dc3936ef94583e694ac2b7a919c5585e1cfc94e2c4a590bcae
build_command: cd packages/contracts && forge clean && forge build
build_exit_code: 0
build_output_hash: sha256:baec41c1f2daee3ef94a67cde25ba258da09ad977ad1771823981f28bcfb4a64
```

## Verification Report

**Change**: contracts (PLAN M7 code subset)
**Version**: N/A
**Mode**: Strict TDD (Solidity, Q21)
**Verified at**: `origin/feature/deploy-dry-run` b173c09 (stack tip, PR #168), detached worktree

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 33 |
| Tasks complete | 33 |
| Tasks incomplete | 0 |

Out of scope, reported as NOT-VERIFIABLE (not FAIL): T7.9 (O5), T7.11 (L1 Permit2/x402 deploy), T7.12 (live testnet deploy), M8 gas re-measurement with the real ICTT messenger. O7 (own ICTT interfaces license) is a pending human sign-off.

### Build and Tests Execution
| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `forge fmt --check` | exit 0 |
| `forge clean && forge build` | exit 0 (lint notes only) |
| `forge test` | 207 passed, 0 failed, 1 skipped (Fuji fork, gated by `FUJI_FORK=1`), 34 suites |
| `FOUNDRY_PROFILE=deep forge test --match-path 'test/invariants/*'` | 9/9 pass, 512 runs, 102400 calls each, 0 reverts |
| `forge snapshot --check --tolerance 1 --match-path 'test/gas/*'` | exit 0 |
| `bulloak check 'test/**/*.tree'` | all checks passed |
| `lintspec` | no issue found |
| `pnpm lint:sol` | 0 errors, 41 warnings (ordering from Bulloak scaffold) |
| `pnpm contracts:policy` | ok |
| `pnpm contracts:abi` | no diff in the worktree |
| root `pnpm typecheck` / `pnpm test` / `pnpm lint` | exit 0 / 438 passed (50 files) / clean |
| `FUJI_FORK=1 forge test --match-contract UnitDeployFuji` (read-only fork) | 12/12 pass |
| anvil L1 dry-run (`forge script DeployL1`, fixtures, no broadcast) | simulation complete, anvil block 0, tree clean |

Coverage (report only, `forge coverage --ir-minimum`): lines IcttMessenger 100%, PaymentHub 100%, SettlementReceiver 100%, PaymentBroker 97.7%, libraries 100%; branches 93.3% to 100%. `test_GivenTooLittleGasToFundTheFullCallback` fails only under coverage instrumentation (gas-sensitive); it passes in the normal run.

No broadcast, no key, no transaction was sent.

### Strict TDD Compliance
- Apply-progress holds a TDD Cycle Evidence table for every batch; all listed test files exist and pass now.
- Ordering (tree before red before green, `git merge-base --is-ancestor`): 30 of 30 triples correct.
- Red commits fail, reproduced by checkout: #118 91409db (build fails), #124 b0b3dab (11 tests fail), #142 d756bd3, #152 396d6ad, #160 12bc22d, #164 46e1109, #154 27ed876, #140 a1de96e, #134 4b8ae91, #158 f126b68 (build fails each), #136 bfb4769 (`snapshot --check` exit 1), #108 32d2465 (build fails once the pins are absent from node_modules), #168 2e92cb0 and 1b2174b (Vitest red). Tree commits build (aef5b5f, 3c98ace, 492a854).
- Exception: #134 (hub invariants) and #158 (broker invariants) have no tree commit (documented: Bulloak scaffolds `test_` functions only).
- PR size (additions plus deletions excluding lockfile and generated ABIs, measured between consecutive PR heads): max 399 (#120), all 31 at or below 400.
- CI (latest run per check): every check on #108 to #168 is SUCCESS or SKIPPED; none failing or pending; #168 includes `contracts dry-run`.

### Spec Compliance Matrix (summary; every scenario mapped to a passing test)
| Capability | Req | Scenarios | Result |
|---|---|---|---|
| contracts-toolchain | 7 | 14 | 14 COMPLIANT, one with a warning (Typed ABI W4: `as const` and FQN keys tested in `scripts/export-abi.test.ts`, viem `getContract` inference is not tested) |
| chain-registry | 1 | 8 | 8 COMPLIANT (`test/unit/Registry.t.sol:20-84`, PLAN.md:545 ticked) |
| icm-interfaces | 4 | 6 | 6 COMPLIANT (`test/unit/IcmInterfaces.t.sol:37-69`, `PROVENANCE.md`, docs, ADR 0009) |
| payment-hub | 12 | 40 | 40 COMPLIANT; Invariants requirement only partly met (see W2) |
| ictt-messenger | 3 | 9 | 9 COMPLIANT (`IcttMessenger.t.sol:26-62`, `IcttMessengerSend.t.sol:54-125`) |
| settlement-receiver | 7 | 16 | 16 COMPLIANT (`SettlementReceiver{Validation,Outcome,Withdraw,Callback}.t.sol`, invariants, gas) |
| ccip-payment-broker | 9 | 21 | 21 COMPLIANT (`PaymentBroker{Entry,Message,Refusal}.t.sol`, `BrokerSimulator.t.sol`, invariants, `scripts/broker-abi.test.ts`) |
| contracts-deployment | 8 | 19 | 19 COMPLIANT (`Deploy*.t.sol`, `scripts/{deploy-safety,fixture-drift,readme-templates}.test.ts`, CI dry-run job) |

Totals: 51 requirements, 133 scenarios, all counted complete because every scenario has a passing covering test. Two items are counted complete with a warning because their coverage is partial: Typed ABI (W4) and the payment-hub Invariants requirement (W2).

### Coherence (design and deviations)
| Deviation in apply-progress | Judgment |
|---|---|
| PR splits (1c, 7b, 8b/8c, 9b, 10b, 11b, 12b, 13b/13c, 15a to 15c, 16a/16b) and seam moves (PR 11 at step 8, `IMessenger` in 8c) | Accepted: required by the 400 line rule, own issues, no size exception. |
| Budget 0 reads `PaymentHub_Unauthorized` | Accepted with W5: only an exactly spent budget differs from the spec wording. |
| Dirty-bit payload checks (broker payer word, receiver merchant word) | Accepted, stricter and safer than the spec; sync the spec. |
| Invariant 4 as `granted == paid + remaining` | Accepted, stricter than `paid <= granted`. |
| Fuji fork test informational in CI | WARNING W3 (spec says CI MUST dry-run on a fork); passes locally with the flag. |
| Params file `twinpay-l1.json` | Accepted: spec requires `<chainKey>.json`; the task text said `l1.json`. |
| Contracts in `src/` not `src/contracts/` | Accepted, cosmetic (tasks text only). |
| Nightly uses the existing `deep` profile (depth 200) | Accepted, exceeds the spec. |

### Security pass (src/, security skill checklist)
No CRITICAL or HIGH finding.
- Reentrancy and CEI: every state-changing hub entry (`pay`, `settle`, `dispatch`, `refund`, `withdraw`) is `nonReentrant` (transient guard); status is written first (`_transition`), amounts zeroed before transfers; receiver `receiveTokens` and `withdraw` guarded; messenger is hub-only; broker is router-only and writes status before the dispatch call.
- Access control: `Ownable2Step` on hub, broker and receiver; owner can only enable messengers, set allowlist pairs or merchants; no function moves, redirects or freezes funds.
- Signature replay: EIP-712 domain with name, version, chain id, hub address; per-authorizer `Nonces`; deadline check first; `SignatureChecker` covers EOA and ERC-1271; tested for replay, wrong nonce, other chain, other hub, rejecting wallet. OZ ECDSA rejects malleable signatures.
- Allowlists: broker `(selector, sender)` pair bound to one payer, checked first, then replay guard by message ID; receiver validates caller, source chain, origin transferrer, origin sender and token before decoding.
- Token accounting: `pay` records the balance delta (fee-on-transfer tested); zero delta reverts; messenger and hub assert zero allowance after use.
- Gas griefing: callbacks capped at 100000 gas with a 63/64 plus 30000 reserve pre-check (tested starved, burning and reentrant callbacks); broker `MIN_RELAY_GAS` 500000 versus 313450 measured accept path.

### Issues Found
**CRITICAL**: None.

**WARNING**
- W1 (Medium, functional, confirmed by a temporary test, removed): `DeployFuji.deploy` calls `enableMessenger` and `setAllowedSender`, and `DeployL1.deploy` calls `setMerchant`, all `onlyOwner`, under `vm.startBroadcast(deployer)`. With `owner != deployer` in params they revert `OwnableUnauthorizedAccount`. Fixtures and committed params always set both equal, so no test covers it. Fail-safe (no funds at risk) but T7.12 with a multisig owner will fail. Fix: deploy with the deployer as owner then `transferOwnership`, or run the owner calls only when equal, plus a test with distinct addresses (`script/DeployFuji.s.sol:104-108`, `script/DeployL1.s.sol:88-90`).
- W2 (hub invariants): `test/invariants/PaymentHub.invariants.t.sol` asserts only terminal-absorbing and balance conservation. Spec invariants (2) table edges per `StatusChanged`, (4) settle/dispatch and refund mutually exclusive, and (5) budget never increases except through `setAuthorizationWithSig` are not asserted, and the handler never sets authorizations or pays through a delegate, so the budget path has unit tests only. "Every terminal status reached" is checked through call counters, not reached statuses.
- W3 (Fuji fork scenario): `.github/workflows/ci.yml:293` runs the Fuji dry-run as `continue-on-error`, so the spec MUST (CI dry-runs against a Fuji fork) is not enforced. Verified manually here (12/12). Record as an accepted spec delta, or add a blocking scheduled run.
- W4 (Typed ABI): no test proves viem `getContract` infers function names and argument types without casts; only the `as const` text shape is tested.
- W5 (spec wording): `_spendBudget` returns `PaymentHub_Unauthorized` when the remaining budget is exactly 0, so the broker's `MessageRejected` reason for a fully spent budget is the `Unauthorized` selector, not `BudgetExceeded` ("Budget spent: remaining budget below amount"). Tests use a non-zero remainder. Update the spec delta at archive.
- W6 (NOT-VERIFIABLE integration risk): the reject path and the `InsufficientCallbackGas` revert rely on real ICTT semantics (unused allowance swept to `fallbackRecipient`, revert sends the whole amount to the fallback). They are proven only against `TestTokenTransferrer`; confirm on the real contracts in T7.12 and M8.
- W7 (process): #134 and #158 have no tree commit, against "tree commit, then red, then green". Documented and justified; record at archive.
- W8 (Low, authorization design): an authorizer cannot invalidate an outstanding signed authorization except by getting a replacement signed at the same nonce included first; the authorized broker can front-run it. The budget replace semantics also has the usual allowance race. Consider an authorizer-callable nonce invalidation or short deadlines.

**SUGGESTION**
- Add zero-address checks to `PaymentBroker` (hub) and `SettlementReceiver` constructors; a zero hub makes every `ccipReceive` revert (misconfiguration only, not exploitable).
- `IcttMessenger.send` does not enforce a zero post-balance; a transferrer that pulls less leaves tokens stranded in the messenger (no rescue). Consider reverting on non-zero balance, as the hub does for allowance.
- `refund` pushes to the payer; a reverting or blacklisted payer blocks only its own refund. Document it.
- `PaymentBroker` records a final `Rejected` if `hub.pay` runs out of gas and enough gas remains for the catch; only an allowlisted sender (trusted) can pick a gas-burning lane token. Informational.
- Root `pnpm test` prints Vitest coverage `PARSE_ERROR` warnings for `packages/contracts/src/**` (`.sol`, `.md`); exit code 0. Exclude them from the coverage include.
- Sync the specs with the dirty-bit checks and the stricter invariant 4; fix task text paths (`src/` and `twinpay-l1.json`).
- Keep O7 (human sign-off) and the pending T7.9, T7.11, T7.12 visible in the archive notes.

### Verdict
PASS WITH WARNINGS
0 CRITICAL, 8 WARNING, 7 SUGGESTION: all tests, gates and CI are green, every scenario has a passing covering test (two items partial, W2 and W4), strict TDD order and red states reproduced; warnings are the owner-not-deployer deploy bug, missing hub invariants, the non-blocking Fuji fork step and spec sync items.

## Re-verify after batch 6

Scope: PRs #170 (W1), #172 (W2) and #174 (zero-address constructor checks), verified on `origin/feature/constructor-zero-checks` at 437c1c1 (stacked on the other two). No code changes, no broadcast, no keys.

### Gates (all green)
- `forge clean && forge build`: exit 0. `forge test`: 226 passed, 0 failed, 1 skipped.
- `FOUNDRY_PROFILE=deep forge test --match-path 'test/invariants/*'`: 12 passed (hub 5/5).
- `forge snapshot --check --tolerance 1 --match-path 'test/gas/*'`: pass. `bulloak check 'test/**/*.tree'` (as `pnpm test:bulloak:check`): no issues. `lintspec`: no issue.
- `pnpm contracts:abi`: no diff. Root `pnpm typecheck`, `pnpm test`, `pnpm lint`: pass.
- CI on #170, #172, #174: every check passes, none failing or pending.

### W1 (deploy owner handoff): CLOSED
- Scripts construct with the deployer, run the `onlyOwner` config, then `_offerOwnership` (skipped when owner equals deployer); records carry `pendingOwner`.
- Tests: owner other than deployer succeeds, config applied, `owner()` is the deployer, `pendingOwner()` is the params owner, and `acceptOwnership` completes the handoff; owner equal to deployer leaves `pendingOwner` zero; the record JSON holds `pendingOwner` in both cases (Fuji hub and broker, L1 receiver).
- Red 04a6957 fails (3 Fuji failures, `OwnableUnauthorizedAccount` and a missing `.pendingOwner`); green 361a0b2 passes (Deploy 8, Fuji 15 + 1 skipped, L1 15).
- Nonce prediction (ADR 0010) unchanged: the receiver is still the deployer's first transaction, the offer follows it, and the `Deploy_NonceMismatch` and `Deploy_AddressMismatch` checks still pass; ADR 0010 documents it.

### W2 (hub invariants): CLOSED, one residual suggestion
- Invariant 2: `invariant_OnlyTableEdgesAreObserved` reads `StatusChanged` events, requires every observed edge in `PaymentStateLib.canTransition`, each change to continue the last seen status, and the edge total to equal the pay, settle, dispatch and refund calls.
- Invariant 4: `invariant_PaidAndRefundedAreExclusive` flags a payment that reached both a paid exit (Settled or Dispatched) and Refunded; the handler races exits at the deadline.
- Invariant 5: `invariant_BudgetOnlyChangesBySignatureOrDelegatePay` compares `exposed_budget` with a ghost budget updated only by `setAuthorizationWithSig` (EIP-712 signed by key-backed payers) and delegate payments, over all payer, broker and token combinations.
- Non-vacuity: the invariant suite asserts every handler action ran at least once (pay, settle, dispatch, refund, withdraw, warp, retry, authorize, delegate pay, race, both tokens). The budget invariant had an isolating mutation (budget not decremented).
- The note that invariant 4's event check had no isolating mutation is judged acceptable: exclusivity is a corollary of the edge table plus chain continuity (Refunded is reachable only from Pending, Settled and Dispatched leave Pending), so any break trips invariant 2 first. The check is redundant, not wrong; operator precedence of `== A | B` is correct in Solidity.
- SUGGESTION: the exclusivity assertion has no independent mutation; consider a stateless assertion on final statuses if it should stand alone.

### Zero-address constructor checks: CONFIRMED
- `PaymentBroker` reverts `PaymentBroker_ZeroAddress` for a zero hub; `SettlementReceiver` reverts `SettlementReceiver_ZeroAddress` for a zero transferrer, origin transferrer, origin sender or token. Existing errors reused, only NatSpec changed, ABI unchanged (`pnpm contracts:abi` no diff).
- Red babd749 fails (4 receiver and 1 broker tests, "did not revert"); green 437c1c1 passes (3 and 5 tests).
- The earlier zero-address SUGGESTION is closed.

### Remaining
- 0 CRITICAL.
- WARNING (6 open): W3 (Fuji fork non-blocking in CI, accepted spec delta), W4 (viem `getContract` inference test), W5 (budget 0 reads Unauthorized), W6 (real ICTT semantics, T7.12 and M8), W7 (#134 and #158 without tree commit), W8 (no authorizer-side nonce invalidation).
- SUGGESTION: the six earlier ones except zero-address, plus the invariant 4 independence note above.

### Verdict
PASS WITH WARNINGS
0 CRITICAL, 6 WARNING, 7 SUGGESTION: W1 and W2 are closed with reproduced red and green states, zero-address checks confirmed, all gates and CI green; the remaining warnings are spec sync, a non-blocking Fuji fork step, accepted design limits and integration risks deferred to T7.12 and M8.
