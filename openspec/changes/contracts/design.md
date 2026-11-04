# Design: Contracts (M7 code subset)

## Technical Approach

One Foundry project in `packages/contracts` (Wonderland `504ada8` layout, pnpm deps, solc 0.8.30, `cancun`). Four
immutable contracts follow standards §1 to §3 and meet through `IMessenger`, `IPaymentCallback`, and our ICTT
interfaces. Scripts read facts from `packages/chains/registry` and parameters from `script/params`.

**Out of scope:** T7.9 (Sepolia sender, O5), T7.11 (Permit2 and x402 proxy on the L1), T7.12 (security checklists
and testnet deploy), and any `--broadcast` or mainnet write.

## Architecture Decisions

| Decision | Choice | Rejected | Why |
|---|---|---|---|
| D1 Constructor cycle (ADR 0010, PR 10) | Both immutable. The Fuji script gives the messenger `computeCreateAddress(receiverDeployer, nonce)` from params; the L1 script asserts nonce and prediction before broadcasting, and the address after | Set-once field; CREATE3 | No mutable trust; CREATE3 needs a factory per chain. A burned nonce means a new messenger |
| D2 ICTT interfaces (ADR 0009, PR 3) | Own MIT `IERC20SendAndCallReceiver`, `IERC20TokenTransferrer` (only `sendAndCall`, file-level `SendAndCallInput`), `PROVENANCE.md` | Vendoring | O7 is open; a pin test catches drift |
| D3 Deploy inputs (ADR 0011, PR 15) | Registry: verified facts, plus optional `icm.blockchainId`, `usdcTokenHome`, `usdcTokenRemote` (filled by M6). Params: deployers, owners, gas limits, fallback recipient, allowlists | Wallets in the registry | T4.1 admits verified facts only |
| D4 Reader (PR 2) | `script/lib/Registry.sol`; `CHAIN_REGISTRY_DIR` override; `keyOf` scans known keys, skipping missing files; digit-checked string selectors | `parseJsonUint` | Named errors |
| D5 State tables (PR 4, 11) | `PaymentStateLib`: `HUB_EDGES`, `RECEIVER_EDGES` (bit `from * 8 + to`), typed `canTransition` overloads | One library each | One pattern |
| D6 Callbacks (PR 8, 12) | `PaymentCallbackLib`: skip EOAs, `try` without return data. Each contract reverts `<Contract>_InsufficientCallbackGas` unless `gasleft()` covers `CALLBACK_GAS * 64 / 63` plus a reserve | Bare `try` | Permissionless `settle` could starve callbacks |
| D7 Dispatch (PR 8, 10) | Hub `forceApprove`s the escrow, calls `send`, reverts unless the allowance is 0; the messenger pulls, approves the transferrer, calls `sendAndCall` with zero fees | Push transfer | Checked zero residue |
| D8 Broker flow (PR 13) | See [PaymentBroker](#paymentbroker). Failing `try pay`: `Rejected`. Failing `try dispatch`: `Accepted` plus `DispatchFailed`. Only tests build V3 extraArgs | Self-call around both | A low `gasLimit` reverts (re-executable), not a false final `Rejected` |
| D9 Payer binding (PR 13) | `setAllowedSender(selector, sender, payer)` binds each pair to one payer; a zero payer removes it. A payload `onBehalf` mismatch records `Rejected` (reason `PaymentBroker_PayerMismatch`), no revert | Shared budget; revert on mismatch | A pair spends only its payer's budget; outcomes stay final |
| D10 Dependencies (PR 1) | Exact pins per standards §4, including `@chainlink/local` `0.3.1` as its own pin. `forge-std` is pinned once as `github:foundry-rs/forge-std#v1.9.4`, the tag `@chainlink/local@0.3.1` itself depends on, so only one copy resolves. `allow_paths = ['../../node_modules']` | Wonderland's `forge-std` `v1.9.2` | One forge-std; pnpm symlinks |
| D11 CI (PR 1, 9, 15) | Job `contracts` runs the [toolchain checks](#toolchain-checks); job `contracts-dry-run` runs both dry-runs. Both in `ci-gate`; `contracts-nightly.yml` runs the `deep` profile. No new hooks | Package hooks | Root CI gates |
| D12 Scripts (PR 15, 16) | `run()` reads files; `deploy(inputs)` returns addresses, so one test chains Fuji then L1. `vm.startBroadcast(params.deployer)` binds the signer; a serializer feeds records, written only in `ScriptBroadcast` context | Script per contract | Deterministic tests |

## Contract Building Blocks

### PaymentHub

| Element | Design |
|---|---|
| Owner | OZ `Ownable2Step`; the owner only calls `enableMessenger` (enable-only, zero reverts) and has no path to funds |
| Lanes | Permissionless `createLane`; `LaneParamsLib.id(params) = Id.wrap(keccak256(abi.encode(params)))`; `messenger == 0` is a local lane with `destination == 0` |
| Authorization | OZ `EIP712('PaymentHub', '1')`; typehash `Authorization(address authorizer,address authorized,address token,uint256 budget,uint256 nonce,uint256 deadline)`; `SignatureChecker.isValidSignatureNow` (EOA and ERC-1271); `Nonces._useCheckedNonce`; sets (replaces) the budget |
| Budget cap | `pay` by `onBehalf` itself needs no budget; any other caller needs `budget[onBehalf][caller][token] >= amount`, which drops by `amount` and is never restored |
| Reentrancy | `ReentrancyGuardTransient` on `pay`, `settle`, `dispatch`, `refund`, `withdraw`; checks-effects-interactions; `SafeERC20` |

Deadline boundary:

| Call | Allowed when | Otherwise |
|---|---|---|
| `pay` | `deadline > block.timestamp` | `PaymentHub_InvalidDeadline` |
| `settle`, `dispatch` | `block.timestamp <= deadline` | `PaymentHub_DeadlinePassed` |
| `refund` (permissionless, pays the recorded payer) | `block.timestamp > deadline` | `PaymentHub_DeadlineNotReached`, including at `==` |

### SettlementReceiver

| Step | Check or action | Failure |
|---|---|---|
| 1 | `msg.sender == TRANSFERRER` | `UnauthorizedCaller` |
| 2 | `sourceBlockchainID == SOURCE_BLOCKCHAIN_ID` | `InvalidSourceBlockchain` |
| 3 | `originTransferrer == ORIGIN_TRANSFERRER` | `InvalidOriginTransferrer` |
| 4 | `originSender == ORIGIN_SENDER` (the messenger) | `InvalidOriginSender` |
| 5 | `token == TOKEN` | `InvalidToken` |
| 6 | `amount > 0`; payload is 64 bytes `(paymentId, merchant)` | `ZeroAmount`; `InvalidPayload` |
| 7 | `None -> Received` | `InvalidTransition` (duplicate ID) |
| 8 | Merchant on the owner allowlist (`setMerchant`, `Ownable2Step`): pull with `transferFrom`, credit, `Received -> Settled`, callback. Otherwise `Received -> Rejected`, nothing pulled | none; the remote sweeps a rejected amount to `fallbackRecipient` |

### PaymentBroker

`CCIPReceiver` (router in the constructor) plus `Ownable2Step`. It does NOT override `getCCVsAndFinalityConfig`, so full
finality and default CCVs apply. `_ccipReceive` order: pair allowlist, message-ID guard, no tokens,
`data.length == 128`, decode, payer match, `MIN_RELAY_GAS` floor, `try pay`, `try dispatch`.

## Events

| Contract | Events |
|---|---|
| `PaymentHub` | `MessengerEnabled`, `LaneCreated`, `AuthorizationSet`, `StatusChanged(id, paymentId, from, to)`, `Withdrawn(token, merchant, amount)`, `CallbackFailed(paymentId, merchant)` |
| `IcttMessenger` | `PaymentSent(id, paymentId, merchant, amount)` |
| `SettlementReceiver` | `StatusChanged(paymentId, from, to)`, `MerchantSet(merchant, allowed)`, `Withdrawn(merchant, amount)`, `CallbackFailed(paymentId, merchant)` |
| `PaymentBroker` | `AllowedSenderSet(sourceChainSelector, sender, payer)`, `MessageAccepted(messageId, laneId, paymentId)`, `DispatchFailed(messageId, paymentId, reason)`, `MessageRejected(messageId, reason)` |

Ownership events come from OZ.

## Data Flow

    Sepolia agent ─CCIP─> PaymentBroker ─pay, dispatch─> PaymentHub ─approve─> IcttMessenger
      ─sendAndCall─> ICTT home ═ICM═> ICTT remote ─receiveTokens─> SettlementReceiver
      ─> Settled (credit) | Rejected (sweep to fallbackRecipient)

## Deployment

| Topic | Design |
|---|---|
| Fuji record | `packages/chains/deployments/fuji.json`: `chainId`, `deployer`, `hub`, `broker`, `messenger`, `receiverDeployer`, `receiverDeployerNonce`, `predictedReceiver`. L1 record: `chainId`, `deployer`, `receiver` |
| `fs_permissions` | Read: `../chains/registry`, `./script/params`, `./test/fixtures`. Read-write: `../chains/deployments` only |
| Allowlists | From params only: broker pairs `(chain key, sender, payer)` with the selector read from the registry; receiver merchants. None present: no call, one log line |
| Verification | `packages/contracts/README.md` templates with `--compiler-version 0.8.30 --evm-version cancun` and the build's optimizer settings: Snowtrace for Fuji (endpoint confirmed in PR 16), Builder Hub verifier for the L1, labeled unverified |

## Toolchain Checks

| Check | Implementation |
|---|---|
| Format, build, test | `forge fmt --check` (Wonderland `[fmt]`: 120 columns, tab 2, single quotes, sorted imports), `forge build`, `forge test` |
| Compiler | `forge config --json` reports `0.8.30` and `cancun`; policy script requires `pragma solidity 0.8.30;` in every `.sol` file |
| Dependency probe (PR 1) | `test/Probe.t.sol` imports one symbol from OZ 5.7, both OZ aliases, `contracts-ccip`, `contracts`, `local`, and `forge-std` |
| Policy script | `scripts/check-policy.ts`: exact pins (version, `npm:` alias, or `github:` tag); no `.gitmodules` or `lib/`; no `.husky/`, `commitlint.config.*`, `.github/`, or `deploy:mainnet`; secrets scan (key material, `PRIVATE_KEY`, `--private-key`, `--broadcast`, credentialed URLs outside `${ENV}`) |
| Lint and trees | `bulloak check`, lintspec, solhint (`solhint-config-wonderland`) |
| Gas, ABI | `forge snapshot --check` on `test/gas`; ABI export then `git diff --exit-code` |

## File Changes

    packages/contracts/
      foundry.toml, remappings.txt, .solhint.json, .lintspec.toml, package.json, README.md
      src/{contracts,interfaces,interfaces/external/icm,libraries}/
      script/{Deploy.sol,DeployFuji.s.sol,DeployL1.s.sol,lib/Registry.sol,params/}
      test/{unit,integration,invariants,gas,utils,fixtures}/, test/Probe.t.sol
      scripts/{export-abi.ts,check-policy.ts}, abi/generated/ (Biome-excluded)
    .github/workflows/{ci.yml,contracts-nightly.yml}
    packages/chains/src/registry.ts (icm field), biome.json, .gitignore
    docs/adr/0009 to 0011, PLAN T7.2 and T7.10, standards §4, decisions O7

## Interfaces / Contracts

```solidity
interface IMessenger {
  function send(Id _id, bytes32 _paymentId, IPaymentHub.LaneParams calldata _lane, uint256 _amount) external;
}

interface IPaymentCallback {
  function onPaymentSettled(bytes32 _paymentId, address _token, uint256 _amount) external;
}
// ICTT payload: abi.encode(bytes32 paymentId, address merchant)
// CCIP data: abi.encode(Id laneId, address onBehalf, uint256 amount, uint256 deadline)
```

Hub storage: `paymentId = keccak256(abi.encode(block.chainid, hub, ++count))`; slot `{payer, uint64 deadline, status}`
plus `amount`; `withdraw(address _token)`.

Final error names, identical in the specs:

| Prefix | Names |
|---|---|
| `PaymentHub_` (beyond standards) | `ZeroAddress`, `InvalidLane`, `LaneExists`, `InvalidDeadline`, `WrongLaneKind`, `DeadlinePassed`, `AllowanceNotConsumed`, `InsufficientCallbackGas`; nonce reuse: OZ `InvalidAccountNonce` |
| `IcttMessenger_` | `OnlyHub`, `DestinationMismatch`, `TokenMismatch`, `ZeroAmount`, `ZeroAddress`, `ZeroBlockchainId`, `InvalidGasLimits` |
| `SettlementReceiver_` | `UnauthorizedCaller`, `InvalidSourceBlockchain`, `InvalidOriginTransferrer`, `InvalidOriginSender`, `InvalidToken`, `ZeroAmount`, `ZeroAddress`, `InvalidPayload`, `InvalidTransition`, `InsufficientCallbackGas` |
| `PaymentBroker_` | `SourceNotAllowed`, `MessageAlreadyProcessed`, `UnexpectedTokens`, `InvalidPayload`, `InsufficientGas`, `ZeroAddress`, `PayerMismatch` (reason code only) |
| `Deploy_`, `Registry_` | `UnsupportedChain`, `ParamNotFound`, `NonceMismatch`, `AddressMismatch`; `UnknownChainId`, `EntryNotFound`, `InvalidSelector` |

## Testing Strategy

| Layer | How |
|---|---|
| Unit | Bulloak trees per transition, `_transition` harness, ERC-1271 wallet, fee-on-transfer and reverting-callback doubles, selector pins, deadline boundary at `==` |
| Integration | `CCIPLocalSimulator` accept, reject (outer `ReceiverError`), duplicate; hub to receiver via `TestTokenTransferrer`; Fuji then L1 `deploy()` |
| Invariant | Hub, receiver, and broker (payer binding, final statuses) ghost handlers, `fail_on_revert`, depth 100, `afterInvariant` coverage |
| Gas, dry-run | `test/gas` limit asserts; Fuji fork and anvil fixtures, fixture facts equal to the registry |

Strict TDD (Q21) for every Solidity PR (contracts, libraries, reader, scripts), in commit order:

| Commit | Content | CI state |
|---|---|---|
| 1 | `.tree` plus `pnpm test:bulloak:scaffold` output | Builds |
| 2 | Test bodies that fail (red) | `forge test` fails |
| 3 | Implementation (green), then optional refactor commits | Green |

TypeScript (ABI export, policy script) needs tests, not this order.

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration
boundary.

## Migration / Rollout

No migration required. Nothing is broadcast; real params arrive with T7.12 keystores.

## Open Questions

- [ ] Pin bulloak and lintspec versions and their CI installer in PR 1.

## Verified by the orchestrator (2026-11-04)

- Toolchain pins: bulloak `0.9.2` (crates.io), CI action `smol-ninja/bulloak-toolchain` `v2.2.0` at `d4e00e1dc5673d3e6731ac37b8cdbb3f451863be`; lintspec `0.20.0`, CI action `beeb/lintspec` `v0.20.0` at `a9e8a9437c74d8d4fd30a39e3d25197b98196264`; Foundry `1.5.1` locally.
- Dependencies: `@openzeppelin/contracts@5.7.0` (npm `latest` tag is 5.6.1; pin 5.7.0 exactly), `@chainlink/contracts-ccip@2.0.0`, `@chainlink/local@0.3.1`, `@chainlink/contracts@1.5.0`.
- bulloak and lintspec are not installed locally; apply installs the pinned versions (`cargo install bulloak --version 0.9.2 --locked`, `cargo install lintspec --version 0.20.0 --locked`) or uses the CI actions.
