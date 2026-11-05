# Settlement Receiver Specification

## Purpose

`SettlementReceiver` on TwinPay L1: the ICTT `receiveTokens` target that validates the source, then records `Received -> Settled` or `Received -> Rejected` per payment (T7.7, Q14).

## Errors and events

Errors (declared in `ISettlementReceiver`): `SettlementReceiver_UnauthorizedCaller(address caller)`, `SettlementReceiver_InvalidSourceBlockchain(bytes32 sourceBlockchainID)`, `SettlementReceiver_InvalidOriginTransferrer(address originTransferrer)`, `SettlementReceiver_InvalidOriginSender(address originSender)`, `SettlementReceiver_InvalidToken(address token)`, `SettlementReceiver_ZeroAmount()`, `SettlementReceiver_ZeroAddress()`, `SettlementReceiver_InvalidPayload()`, `SettlementReceiver_InvalidTransition(Status current, Status to)`, `SettlementReceiver_InsufficientCallbackGas()`. Events: `StatusChanged(bytes32 indexed paymentId, Status from, Status to)`, `MerchantSet(address indexed merchant, bool allowed)`, `Withdrawn(address indexed merchant, uint256 amount)`, `CallbackFailed(bytes32 indexed paymentId, address indexed merchant)`.

## State table

| From | To | Trigger | Guard |
|---|---|---|---|
| None | Received | `receiveTokens` | all source checks pass, payment ID unused |
| Received | Settled | internal, same call | merchant is allowlisted |
| Received | Rejected | internal, same call | merchant is not allowlisted |

Terminal: Settled, Rejected. `Settled` and `Rejected` are reached inside the `receiveTokens` transaction, which emits two `StatusChanged` events (None to Received, then the outcome). Every change goes through `_transition`, which reverts `SettlementReceiver_InvalidTransition(current, to)` on a wrong from-state or a non-table edge. `Rejected` means the merchant is not on the owner-managed allowlist.

## Requirements

### Requirement: Source validation first

`receiveTokens(sourceBlockchainID, originTransferrer, originSender, token, amount, payload)` MUST check, before decoding the payload or writing any state: the caller equals the configured local ICTT transferrer, the source blockchain ID equals the configured one, the origin transferrer equals the configured one, the origin sender equals the configured `IcttMessenger`, and the token equals the configured local token. The failed checks MUST revert, in that order, `SettlementReceiver_UnauthorizedCaller`, `SettlementReceiver_InvalidSourceBlockchain`, `SettlementReceiver_InvalidOriginTransferrer`, `SettlementReceiver_InvalidOriginSender`, and `SettlementReceiver_InvalidToken`. All five values are constructor-injected and immutable. A zero `amount` MUST revert `SettlementReceiver_ZeroAmount`.

#### Scenario: Valid source
- GIVEN all five values match
- WHEN the transferrer calls `receiveTokens`
- THEN processing continues to payload decoding

#### Scenario: Each mismatch
- GIVEN a caller, source ID, origin transferrer, origin sender, or token that differs from configuration
- WHEN `receiveTokens` is called
- THEN each reverts with its named error above and no payment status is written

#### Scenario: Checks precede decoding
- GIVEN a bad source and a malformed payload
- WHEN `receiveTokens` is called
- THEN the source error is returned, not the payload error

### Requirement: Payment keyed by ID, no duplicates

The payload MUST be exactly 64 bytes and decode to `(paymentId, merchant)`; otherwise it MUST revert `SettlementReceiver_InvalidPayload`. A payment ID whose status is not None MUST revert `SettlementReceiver_InvalidTransition(current, Received)`. The receiver MUST trust the delivered `amount` and never read a home-chain amount from the payload.

#### Scenario: First delivery
- GIVEN an unused payment ID
- WHEN `receiveTokens` succeeds
- THEN `StatusChanged(None -> Received)` is emitted before the outcome event

#### Scenario: Duplicate ID
- GIVEN a payment ID already Received, Settled, or Rejected
- WHEN `receiveTokens` is called again
- THEN each reverts `SettlementReceiver_InvalidTransition(current, Received)`

### Requirement: Settle path

For an allowlisted merchant the receiver MUST pull exactly `amount` of the token from the transferrer with `transferFrom`, credit the merchant for later withdrawal, and transition `Received -> Settled`.

#### Scenario: Settled
- GIVEN an allowlisted merchant and a valid delivery
- WHEN `receiveTokens` runs
- THEN the receiver pulled `amount`, the merchant credit rose by `amount`, and status is Settled

#### Scenario: Pull fails
- GIVEN a token pull that reverts
- WHEN `receiveTokens` runs
- THEN the call reverts and no status is stored

### Requirement: Reject path

For a merchant not on the allowlist the receiver MUST pull nothing, transition `Received -> Rejected`, and emit the outcome. It MUST NOT revert. The unused allowance MUST then be swept to the messenger's `fallbackRecipient` by the transferrer.

#### Scenario: Rejected, nothing pulled
- GIVEN a non-allowlisted merchant
- WHEN `receiveTokens` runs
- THEN status is Rejected and the receiver token balance is unchanged

#### Scenario: Funds reach the fallback
- GIVEN a test transferrer that mirrors the allowance sweep and a rejected payment
- WHEN the delivery completes
- THEN `fallbackRecipient` holds the full amount and the receiver holds none

### Requirement: Merchant allowlist

Only the owner (`Ownable2Step`) MUST change merchant allowlist entries with `setMerchant(merchant, allowed)`, each change emitting `MerchantSet`. A zero merchant MUST revert `SettlementReceiver_ZeroAddress`.

#### Scenario: Owner allows
- GIVEN the owner allowlists a merchant
- WHEN a payment for it arrives
- THEN it settles

#### Scenario: Non-owner
- GIVEN any other caller
- WHEN it changes the allowlist
- THEN it reverts `OwnableUnauthorizedAccount`

### Requirement: Merchant withdrawal

A merchant MUST pull its credit with `withdraw()`: it zeroes the credit before transferring, emits `Withdrawn`, and a zero credit reverts `SettlementReceiver_ZeroAmount`. When the merchant has code, `Settled` MUST call `IPaymentCallback.onPaymentSettled` after the transition with a fixed gas cap in a `try`; a failing, out-of-gas, or reentrant callback MUST NOT revert `receiveTokens`, change the credit, or strand funds, and MUST emit `CallbackFailed(paymentId, merchant)`. When `gasleft()` cannot fund the full cap, `receiveTokens` MUST revert `SettlementReceiver_InsufficientCallbackGas`, so ICTT sends the whole amount to `fallbackRecipient`. Reentrant entry points use `ReentrancyGuardTransient`.

#### Scenario: Withdraw
- GIVEN a credit of 5
- WHEN the merchant calls `withdraw`
- THEN it receives 5 and a second call reverts

#### Scenario: Failing callback
- GIVEN a merchant whose callback reverts
- WHEN the payment settles
- THEN the status is Settled, the credit is withdrawable, and `CallbackFailed` is emitted

#### Scenario: Gas below the callback cap
- GIVEN a callback merchant and a delivery whose gas cannot fund the cap
- WHEN `receiveTokens` runs
- THEN it reverts `SettlementReceiver_InsufficientCallbackGas` and the test transferrer sends the full amount to `fallbackRecipient`

### Requirement: Invariants and gas

A handler suite (several merchants, allowlist changes, valid and invalid deliveries) MUST hold: terminal states are absorbing; only table edges occur; the receiver token balance equals the sum of unwithdrawn credits; a Rejected payment never changes the receiver balance; every payment ID has at most one terminal outcome. The settled path MUST fit `recipientGasLimit`, measured with `forge snapshot` and documented.

#### Scenario: Conservation
- GIVEN any handler sequence
- WHEN invariants run
- THEN receiver balance equals ghost credits and no Rejected payment moved funds

#### Scenario: Gas bound
- GIVEN the documented `recipientGasLimit`
- WHEN the settled path is measured
- THEN its gas is below that limit

## Traceability

| Done-when box | Requirement |
|---|---|
| T7.7 checks source ID, origin transferrer, origin sender, token | Source validation first |
| T7.7 Settled pulls and credits; Rejected pulls nothing | Settle path; Reject path; Merchant withdrawal |
| T7.7 keyed by ID; rejected amount reaches `fallbackRecipient` | Payment keyed by ID, no duplicates; Reject path |
| Proposal: callback policy and invariants | Merchant withdrawal; Invariants and gas |
