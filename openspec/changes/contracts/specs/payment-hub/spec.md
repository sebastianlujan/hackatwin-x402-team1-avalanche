# Payment Hub Specification

## Purpose

`PaymentHub`, one immutable singleton per chain: lanes, EIP-712 budgeted authorization, escrowed payments, and a single state machine (T7.3 to T7.5, Q1, Q5, Q21).

## Errors and events

Every error is a distinct custom error declared in `IPaymentHub`. Beyond the standards section 2 list, the final names are `PaymentHub_ZeroAddress`, `PaymentHub_InvalidLane`, `PaymentHub_LaneExists`, `PaymentHub_InvalidDeadline`, `PaymentHub_WrongLaneKind`, `PaymentHub_DeadlinePassed`, `PaymentHub_AllowanceNotConsumed(uint256 remaining)`, and `PaymentHub_InsufficientCallbackGas`. Nonce reuse reverts with OZ `Nonces.InvalidAccountNonce(account, currentNonce)`. Events beyond the standards list: `Withdrawn(address indexed token, address indexed merchant, uint256 amount)` and `CallbackFailed(bytes32 indexed paymentId, address indexed merchant)`.

## State table

| From | To | Function | Extra guard |
|---|---|---|---|
| None | Pending | `pay` | lane exists, budget, deadline in the future |
| Pending | Settled | `settle` | local lane, `block.timestamp <= deadline` |
| Pending | Dispatched | `dispatch` | cross-chain lane, `block.timestamp <= deadline` |
| Pending | Refunded | `refund` | `block.timestamp > deadline` |

Terminal: Settled, Dispatched, Refunded. Enum order: None=0, Pending, Settled, Dispatched, Refunded.

## Requirements

### Requirement: State library and lane id

`PaymentStateLib.canTransition(from, to)` MUST return true for exactly the four table edges and false for every other pair. `LaneParamsLib.id(params)` MUST equal `keccak256(abi.encode(params))` and be injective over distinct params.

#### Scenario: Only table edges pass
- GIVEN every `(from, to)` pair over the five statuses
- WHEN `canTransition` is called
- THEN exactly `(None,Pending)`, `(Pending,Settled)`, `(Pending,Dispatched)`, `(Pending,Refunded)` return true

#### Scenario: Fuzzed pairs
- GIVEN fuzzed `uint8` pairs cast within the enum range
- WHEN `canTransition` is called
- THEN the result is true only for the four edges

#### Scenario: Lane id
- GIVEN two `LaneParams` differing in any one field
- WHEN ids are computed
- THEN the ids differ, and equal params give equal ids

### Requirement: Single write path

Every status change MUST go through `_transition(id, paymentId, from, to)`, which reverts `PaymentHub_InvalidTransition(current, to)` when the stored status differs from `from` or the edge is not in the table, writes the status, and emits exactly one `StatusChanged(id, paymentId, from, to)`. An unknown payment MUST read as `None`.

#### Scenario: Wrong from-state
- GIVEN a payment whose stored status is not `from`
- WHEN `_transition` is exercised through a test harness
- THEN it reverts `PaymentHub_InvalidTransition(current, to)` and emits nothing

#### Scenario: One event per change
- GIVEN any successful `pay`, `settle`, `dispatch`, or `refund`
- WHEN the logs are inspected
- THEN exactly one `StatusChanged` is present

### Requirement: Owner and plug-in registry

The hub MUST use `Ownable2Step`. Only the owner MUST call `enableMessenger`, and a zero address MUST revert. No function MUST let the owner move, redirect, or freeze escrowed or credited funds.

#### Scenario: Owner enables
- GIVEN the owner
- WHEN `enableMessenger(m)` is called
- THEN `MessengerEnabled(m)` is emitted and lanes may use `m`

#### Scenario: Non-owner
- GIVEN any other caller
- WHEN `enableMessenger` is called
- THEN it reverts `OwnableUnauthorizedAccount`

#### Scenario: Two-step handover
- GIVEN `transferOwnership(x)`
- WHEN `x` has not called `acceptOwnership`
- THEN the old owner still holds ownership

### Requirement: Permissionless lanes

`createLane(params)` MUST be callable by anyone. It MUST revert `PaymentHub_ZeroAddress` for a zero token or merchant, `PaymentHub_MessengerNotEnabled(m)` when a non-zero messenger is not enabled, `PaymentHub_InvalidLane` when a local lane (`messenger == 0`) has a non-zero destination or a cross-chain lane has a zero destination, and `PaymentHub_LaneExists` for a repeated id. On success it MUST emit `LaneCreated(id, params)`.

#### Scenario: Create local lane
- GIVEN params with `messenger = 0` and `destination = 0`
- WHEN anyone calls `createLane`
- THEN the id equals `LaneParamsLib.id(params)` and `LaneCreated` is emitted

#### Scenario: Messenger not enabled
- GIVEN a cross-chain lane naming a messenger the owner never enabled
- WHEN `createLane` is called
- THEN it reverts `PaymentHub_MessengerNotEnabled(messenger)`

#### Scenario: Invalid shapes
- GIVEN a zero token, a zero merchant, a local lane with a destination, a cross-chain lane without one, or a duplicate lane
- WHEN `createLane` is called
- THEN each reverts with its own custom error

### Requirement: Signed authorization with budget

`setAuthorizationWithSig(auth, signature)` MUST verify an EIP-712 signature over `Authorization` with `SignatureChecker` (EOA and ERC-1271), the hub domain (name, version, chain ID, hub address), and `Nonces`. It MUST revert `PaymentHub_SignatureExpired` when `block.timestamp > deadline`, `PaymentHub_InvalidSignature` for a bad signature, and OZ `InvalidAccountNonce(account, currentNonce)` for a used or wrong nonce. On success it MUST consume the nonce, set the remaining budget for `(authorizer, authorized, token)` to `auth.budget` (replacing any earlier value), and emit `AuthorizationSet`.

#### Scenario: EOA signature
- GIVEN a valid signature by `authorizer`
- WHEN anyone submits it before the deadline
- THEN the budget is set and the nonce increments

#### Scenario: ERC-1271 wallet
- GIVEN a contract wallet whose `isValidSignature` approves the digest
- WHEN its authorization is submitted
- THEN it succeeds; with a wallet that rejects it, it reverts `PaymentHub_InvalidSignature`

#### Scenario: Replay
- GIVEN an accepted authorization
- WHEN the same signature is submitted again
- THEN it reverts `InvalidAccountNonce` and the budget is unchanged

#### Scenario: Expired and cross-domain
- GIVEN a signature past its deadline, or signed for another chain ID or hub address
- WHEN submitted
- THEN it reverts `PaymentHub_SignatureExpired` or `PaymentHub_InvalidSignature` respectively

### Requirement: `pay` (None to Pending)

`pay(id, onBehalf, amount, deadline)` MUST revert `PaymentHub_LaneNotFound(id)` for an unknown lane, `PaymentHub_ZeroAmount` for zero, and `PaymentHub_InvalidDeadline` when `deadline <= block.timestamp`. The caller MUST be `onBehalf`, or an address authorized by `onBehalf` for the lane token; otherwise `PaymentHub_Unauthorized(caller)`. For an authorized caller it MUST revert `PaymentHub_BudgetExceeded(remaining, amount)` when `amount` exceeds the remaining budget, and otherwise reduce the budget by `amount`. It MUST pull `amount` of the lane token from `onBehalf` with `SafeERC20`, record the escrow as the hub's balance delta, record the payer, return a unique `paymentId`, and transition `None -> Pending`. A zero balance delta MUST revert `PaymentHub_ZeroAmount`. The budget is a lifetime cap: it is never restored.

#### Scenario: Happy path
- GIVEN an existing lane, sufficient allowance, and an authorization with budget >= amount
- WHEN the authorized broker calls `pay`
- THEN status is Pending, escrow equals the delta, and the budget drops by `amount`

#### Scenario: Budget cap
- GIVEN remaining budget 10 and `amount` 11
- WHEN the authorized caller pays
- THEN it reverts `PaymentHub_BudgetExceeded(10, 11)` and no tokens move

#### Scenario: Self-pay needs no authorization
- GIVEN `msg.sender == onBehalf`
- WHEN `pay` is called with no authorization
- THEN it succeeds and no budget is consumed

#### Scenario: Unauthorized caller
- GIVEN a caller with no authorization from `onBehalf`
- WHEN it calls `pay`
- THEN it reverts `PaymentHub_Unauthorized(caller)`

#### Scenario: Fee-on-transfer token
- GIVEN a token that delivers less than `amount`
- WHEN `pay` succeeds
- THEN the recorded escrow equals the delivered delta, not `amount`

#### Scenario: Every non-None from-state
- GIVEN a payment that is Pending, Settled, Dispatched, or Refunded
- WHEN `_transition(None -> Pending)` is attempted through the harness
- THEN each reverts `PaymentHub_InvalidTransition(current, Pending)`

### Requirement: `settle` (Pending to Settled, local lane)

`settle(id, paymentId)` MUST be callable by anyone while `block.timestamp <= deadline` on a local lane. It MUST revert `PaymentHub_InvalidTransition(current, Settled)` from every status except Pending, `PaymentHub_WrongLaneKind` on a cross-chain lane, and `PaymentHub_DeadlinePassed` after the deadline. It MUST transition first, credit the escrow to the merchant balance (pull model), then run an optional callback.

#### Scenario: Happy path
- GIVEN a Pending payment on a local lane before its deadline
- WHEN anyone calls `settle`
- THEN status is Settled, the merchant credit rises by the escrow, and escrow for the payment is zero

#### Scenario: Wrong from-state
- GIVEN a payment that is None, Settled, Dispatched, or Refunded
- WHEN `settle` is called
- THEN each reverts `PaymentHub_InvalidTransition(current, Settled)`

#### Scenario: Wrong lane or late
- GIVEN a cross-chain lane payment, or a local payment after its deadline
- WHEN `settle` is called
- THEN it reverts `PaymentHub_WrongLaneKind` or `PaymentHub_DeadlinePassed` respectively

### Requirement: Merchant withdrawal and callback policy

A merchant MUST withdraw its credited balance with `withdraw(token)`, which zeroes the credit before transferring (checks-effects-interactions), emits `Withdrawn`, and reverts `PaymentHub_ZeroAmount` when nothing is credited. After crediting, `settle` MUST call `IPaymentCallback.onPaymentSettled` on the merchant only when it has code, with a fixed gas cap and a `try` that ignores return data. Before that call, `settle` MUST revert `PaymentHub_InsufficientCallbackGas` when `gasleft()` cannot give the callback its full cap (63/64 rule plus a reserve), so a caller cannot starve the callback. A reverting, out-of-gas, or reentrant callback MUST NOT revert `settle`, MUST NOT change the credit, and MUST emit `CallbackFailed(paymentId, merchant)`.

#### Scenario: Pull withdrawal
- GIVEN a merchant credit of 5
- WHEN the merchant calls `withdraw`
- THEN it receives 5, the credit is zero, and a second call reverts `PaymentHub_ZeroAmount`

#### Scenario: Failing callback
- GIVEN a merchant whose callback reverts or burns all gas
- WHEN `settle` runs
- THEN `settle` succeeds, the credit is intact, and `CallbackFailed` is emitted

#### Scenario: Starved callback refused
- GIVEN a merchant with a callback and a `settle` call given too little gas to fund the full cap
- WHEN `settle` runs
- THEN it reverts `PaymentHub_InsufficientCallbackGas` and the payment stays Pending

#### Scenario: Reentrant callback
- GIVEN a callback that calls `pay`, `settle`, `dispatch`, `refund`, or `withdraw`
- WHEN `settle` runs
- THEN each reentrant call reverts (`ReentrancyGuardTransient`) and the outer `settle` still succeeds

### Requirement: `dispatch` (Pending to Dispatched, cross-chain lane)

`dispatch(id, paymentId)` MUST be callable by anyone while `block.timestamp <= deadline` on a cross-chain lane. It MUST revert `PaymentHub_InvalidTransition(current, Dispatched)` from every status except Pending, `PaymentHub_WrongLaneKind` on a local lane, and `PaymentHub_DeadlinePassed` after the deadline. It MUST transition first, grant the lane messenger an approval of exactly the escrow amount, and call `IMessenger.send`. Afterward the hub's allowance to the messenger MUST be zero; otherwise it MUST revert `PaymentHub_AllowanceNotConsumed(remaining)`. If `send` reverts, the whole call MUST revert and the payment stays Pending.

#### Scenario: Happy path
- GIVEN a Pending cross-chain payment before its deadline
- WHEN `dispatch` is called
- THEN status is Dispatched, the messenger received exactly the escrow, and the allowance is zero

#### Scenario: Wrong from-state
- GIVEN a payment that is None, Settled, Dispatched, or Refunded
- WHEN `dispatch` is called
- THEN each reverts `PaymentHub_InvalidTransition(current, Dispatched)`

#### Scenario: Messenger failure
- GIVEN a messenger whose `send` reverts
- WHEN `dispatch` is called
- THEN it reverts, status stays Pending, and the payment can still be refunded after the deadline

#### Scenario: Messenger leaves allowance
- GIVEN a messenger that pulls less than the escrow
- WHEN `dispatch` is called
- THEN it reverts `PaymentHub_AllowanceNotConsumed(remaining)` and status stays Pending

#### Scenario: No refund after dispatch
- GIVEN a Dispatched payment and a passed deadline
- WHEN `refund` is called
- THEN it reverts `PaymentHub_InvalidTransition(Dispatched, Refunded)`

### Requirement: `refund` (Pending to Refunded)

`refund(id, paymentId)` MUST be permissionless and MUST revert `PaymentHub_DeadlineNotReached` while `block.timestamp <= deadline`, and `PaymentHub_InvalidTransition(current, Refunded)` from every status except Pending. It MUST return the escrow to the recorded payer with `SafeERC20` and MUST NOT restore any authorization budget.

#### Scenario: Refund after deadline
- GIVEN a Pending payment and `block.timestamp > deadline`
- WHEN anyone calls `refund`
- THEN the payer receives the escrow, status is Refunded, and the remaining budget is unchanged

#### Scenario: Too early
- GIVEN a Pending payment at `block.timestamp == deadline`
- WHEN `refund` is called
- THEN it reverts `PaymentHub_DeadlineNotReached`

#### Scenario: Wrong from-state
- GIVEN a payment that is None, Settled, Dispatched, or Refunded
- WHEN `refund` is called after any time warp
- THEN each reverts `PaymentHub_InvalidTransition(current, Refunded)`

### Requirement: Invariants

A handler-based suite with several lanes, tokens, payers, and time warps, plus call-coverage assertions (each function called at least once), MUST hold: (1) terminal states are absorbing; (2) only table edges occur (every observed `StatusChanged` is a table edge, one per change); (3) per token, the hub balance is at least pending escrow plus unwithdrawn merchant credit, and equals it when no tokens are donated (ghost accounting); (4) settle/dispatch and refund are never both possible for one payment; (5) an authorization budget never increases except through `setAuthorizationWithSig`.

#### Scenario: Terminal absorbing
- GIVEN a payment in Settled, Dispatched, or Refunded
- WHEN any handler action runs
- THEN its status is unchanged

#### Scenario: Conservation
- GIVEN any handler sequence
- WHEN `invariant_` checks run
- THEN ghost pending escrow plus ghost credit equals the tracked liability, and the hub balance covers it

#### Scenario: Coverage not vacuous
- GIVEN a completed run
- WHEN call counters are read
- THEN every handler function was called and every terminal status was reached

### Requirement: Gas and NatSpec

lintspec MUST pass on every external item. A `forge snapshot` of `pay` and of `dispatch` MUST be committed, and the required gas of `pay` plus `dispatch` MUST be documented for the CCIP `gasLimit` (M8).

#### Scenario: Snapshot present
- GIVEN the committed snapshot
- WHEN `forge snapshot --check` runs
- THEN it passes and includes `pay` and `dispatch` paths

## Traceability

| Done-when box | Requirement |
|---|---|
| T7.3 one Bulloak tree per transition | State table; `pay`, `settle`, `dispatch`, `refund` requirements |
| T7.3 fuzz: only table edges pass | State library and lane id |
| T7.3 lintspec on every external item | Gas and NatSpec |
| T7.4 lanes need enabled messenger, keyed by `Id` | Owner and plug-in registry; Permissionless lanes |
| T7.4 EIP-712, `SignatureChecker`, `Nonces`, ERC-1271 test | Signed authorization with budget |
| T7.4 replay and expiry rejected with custom errors | Signed authorization with budget |
| T7.5 `SafeERC20`, `ReentrancyGuardTransient`, failing callback cannot strand funds | `pay`; Merchant withdrawal and callback policy; `refund` |
| T7.5 invariants: absorb, table edges, escrowed equals pending | Single write path; Invariants |
| T7.5 budget cap stops `pay` | `pay` |
