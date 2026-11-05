# CCIP Payment Broker Specification

## Purpose

`PaymentBroker` on Fuji: a CCIP 2.0 receiver that turns allowlisted, data-only messages from Sepolia into hub payments (T7.8, C2, Q5). In `CCIPLocalSimulator` tests an inner revert surfaces as the router's outer `ReceiverError`; direct calls assert the inner error.

## Message status

| From | To | Trigger | Event |
|---|---|---|---|
| None | Accepted | `pay` succeeded and `dispatch` succeeded | `MessageAccepted` |
| None | Accepted | `pay` succeeded and `dispatch` reverted: the payment stays Pending, dispatchable by anyone until its deadline, then refundable | `DispatchFailed` |
| None | Rejected | the hub refused `pay`, or the payload `onBehalf` differs from the pair's bound payer | `MessageRejected` |

`Accepted` means a hub payment exists for the message. Both statuses are final and keyed by message ID. A processed message ID never changes status.

## Errors and events

Errors (declared in `IPaymentBroker`): `PaymentBroker_SourceNotAllowed(uint64 sourceChainSelector, address sender)`, `PaymentBroker_MessageAlreadyProcessed(bytes32 messageId)`, `PaymentBroker_UnexpectedTokens()`, `PaymentBroker_InvalidPayload()`, `PaymentBroker_InsufficientGas(uint256 available, uint256 required)`, `PaymentBroker_ZeroAddress()`, and `PaymentBroker_PayerMismatch(address expected, address actual)`, which is used only as a rejection reason code, never reverted. Router restriction: `CCIPReceiver`'s `InvalidRouter(address)` (verified against the installed 2.0.0 source).

Events: `AllowedSenderSet(uint64 indexed sourceChainSelector, address indexed sender, address payer)`, `MessageAccepted(bytes32 indexed messageId, Id indexed laneId, bytes32 paymentId)`, `DispatchFailed(bytes32 indexed messageId, bytes32 paymentId, bytes4 reason)`, `MessageRejected(bytes32 indexed messageId, bytes4 reason)`. A `reason` is the first four bytes of the revert data, or zero when shorter.

## Requirements

### Requirement: Router-only entry

The router MUST be a constructor argument, and no external function other than the owner configuration functions and `ccipReceive` (router-restricted) MUST be able to cause a payment. The broker MUST NOT override the default full-finality `getCCVsAndFinalityConfig`.

#### Scenario: Non-router caller
- GIVEN any address other than the router
- WHEN it calls `ccipReceive`
- THEN it reverts `InvalidRouter(caller)`

#### Scenario: No public entry
- GIVEN the broker ABI
- WHEN external functions are listed
- THEN only `ccipReceive`, owner configuration, and views exist

### Requirement: Source and sender allowlist as a pair, bound to one payer

The owner (`Ownable2Step`) MUST manage allowed `(sourceChainSelector, sender)` pairs with `setAllowedSender(selector, sender, payer)`. Each allowed pair MUST be bound to exactly one payer (`onBehalf`); a zero payer removes the pair. A zero sender MUST revert `PaymentBroker_ZeroAddress`. Each change MUST emit `AllowedSenderSet`. A message MUST be processed only if its exact pair is allowed; otherwise it MUST revert `PaymentBroker_SourceNotAllowed(selector, sender)`. This check runs before any other.

#### Scenario: Allowed pair
- GIVEN the pair `(selector A, sender X)` is bound to payer P
- WHEN a message from that pair arrives
- THEN it is processed

#### Scenario: Pair not mixed
- GIVEN `(A, X)` and `(B, Y)` are allowed
- WHEN messages from `(A, Y)` and `(B, X)` arrive
- THEN both revert `PaymentBroker_SourceNotAllowed`

#### Scenario: Removed pair
- GIVEN the owner rebinds `(A, X)` to the zero payer
- WHEN a message from `(A, X)` arrives
- THEN it reverts `PaymentBroker_SourceNotAllowed(A, X)`

#### Scenario: Simulator reject
- GIVEN a `CCIPLocalSimulator` message from a non-allowlisted sender
- WHEN the router delivers it
- THEN delivery fails with the outer `ReceiverError` wrapping `PaymentBroker_SourceNotAllowed`, and no hub state changes

### Requirement: Payer binding

After decoding, the broker MUST compare the payload `onBehalf` with the payer bound to the message's pair. On a mismatch it MUST record `Rejected`, emit `MessageRejected(messageId, PaymentBroker_PayerMismatch.selector)`, call nothing on the hub, and NOT revert. A pair therefore never spends the budget of a payer it is not bound to.

#### Scenario: Matching payer
- GIVEN `(A, X)` bound to payer P and a payload with `onBehalf = P`
- WHEN the message is delivered
- THEN the broker calls `hub.pay(laneId, P, amount, deadline)`

#### Scenario: Foreign payer
- GIVEN `(A, X)` bound to P, a payer Q who also authorized the broker, and a payload with `onBehalf = Q`
- WHEN the message is delivered
- THEN the status is Rejected with the `PaymentBroker_PayerMismatch` selector, Q's budget and balance are unchanged, and the call does not revert

#### Scenario: Rebinding is not retroactive
- GIVEN a message Rejected for a payer mismatch
- WHEN the owner rebinds the pair to the payload's payer and the same ID is redelivered
- THEN it reverts `PaymentBroker_MessageAlreadyProcessed`

### Requirement: Message-ID guard

Each CCIP message ID MUST be processed at most once. A repeated ID MUST revert `PaymentBroker_MessageAlreadyProcessed(messageId)`. Messages are keyed by ID and never overwrite one another.

#### Scenario: Duplicate
- GIVEN a processed message ID
- WHEN the same message is replayed through `ccipReceive` from the router address
- THEN it reverts `PaymentBroker_MessageAlreadyProcessed` and the hub is untouched

#### Scenario: Independent messages
- GIVEN two different message IDs
- WHEN both are delivered
- THEN each has its own status

### Requirement: Data-only payload

A message that carries tokens MUST revert `PaymentBroker_UnexpectedTokens`. The data MUST be exactly 128 bytes and decode to `(laneId, onBehalf, amount, deadline)`; otherwise it MUST revert `PaymentBroker_InvalidPayload`.

#### Scenario: Tokens attached
- GIVEN a message with non-empty token amounts
- WHEN delivered
- THEN it reverts `PaymentBroker_UnexpectedTokens`

#### Scenario: Malformed data
- GIVEN data that is not 128 bytes
- WHEN delivered
- THEN it reverts `PaymentBroker_InvalidPayload`

### Requirement: Accept path

For an allowed, new, well-formed message with a matching payer the broker MUST call `hub.pay(laneId, onBehalf, amount, deadline)` and then `hub.dispatch(laneId, paymentId)`, record `Accepted`, and emit `MessageAccepted(messageId, laneId, paymentId)`. The broker MUST NOT hold tokens at any time: the hub pulls from `onBehalf`.

#### Scenario: Accept
- GIVEN an allowed message, a hub authorization for the broker with enough budget, and a cross-chain lane
- WHEN delivered through the simulator
- THEN the hub payment goes `None -> Pending -> Dispatched`, the status is Accepted, `MessageAccepted` is emitted, and the broker token balance is zero

### Requirement: Hub refusal is recorded, not reverted

If `hub.pay` reverts (budget exceeded, authorization missing, lane not found, zero amount, invalid deadline), the broker MUST record `Rejected`, emit `MessageRejected` with the revert selector, create no payment, and NOT revert. If `pay` succeeds and `dispatch` reverts, the broker MUST record `Accepted`, emit `DispatchFailed(messageId, paymentId, reason)`, and NOT revert; the payment stays Pending, dispatchable by anyone until its deadline and refundable after it.

#### Scenario: Budget spent
- GIVEN remaining budget below `amount`
- WHEN the message is delivered
- THEN the status is Rejected, `MessageRejected` carries `PaymentHub_BudgetExceeded`'s selector, and no tokens move

#### Scenario: Rejected is final
- GIVEN a Rejected message ID and a topped-up budget
- WHEN the same ID is redelivered
- THEN it reverts `PaymentBroker_MessageAlreadyProcessed`

#### Scenario: Dispatch fails after pay
- GIVEN a messenger that reverts
- WHEN the message is delivered
- THEN the status is Accepted, `DispatchFailed` is emitted, the hub payment is Pending, anyone can still `dispatch` it before the deadline, and `refund` works after it

### Requirement: Gas floor and fit

Before calling the hub, the broker MUST revert `PaymentBroker_InsufficientGas(available, required)` when `gasleft()` is below `MIN_RELAY_GAS`, so a message sent with too low a `gasLimit` fails (re-executable) instead of being recorded as a false final `Rejected`. The gas of `ccipReceive` for the accept path MUST be measured in a deterministic gas test, stay below a documented CCIP `gasLimit` with margin, and be recorded for M8.

#### Scenario: Too little gas
- GIVEN `gasleft()` below `MIN_RELAY_GAS` at the hub call
- WHEN the message is delivered
- THEN it reverts `PaymentBroker_InsufficientGas` and no status is recorded

#### Scenario: Within the limit
- GIVEN the documented `gasLimit`
- WHEN the accept path is measured
- THEN its gas is below the limit

### Requirement: Invariants

A handler suite (several pairs bound to several payers, foreign-payer payloads, budget changes, messenger failures, and replays through the router address) MUST hold: (1) every hub payment created by the broker has the payer bound to its message's pair at delivery; (2) a message status, once set, never changes; (3) the broker token balance is always zero; (4) per payer, the amount the broker paid never exceeds the budgets that payer granted it; (5) no Rejected message created a payment.

#### Scenario: Payer binding holds
- GIVEN any handler sequence
- WHEN invariants run
- THEN every broker-created payment's payer equals the pair's bound payer recorded by the handler

#### Scenario: Coverage not vacuous
- GIVEN a completed run
- WHEN call counters are read
- THEN accept, dispatch-failed, hub-refusal, and payer-mismatch paths each occurred

## Traceability

| Done-when box | Requirement |
|---|---|
| T7.8 router constructor argument; acts only in `_ccipReceive` | Router-only entry |
| T7.8 source selector and sender allowlisted as a pair | Source and sender allowlist as a pair, bound to one payer |
| T7.8 simulator: accept, reject, duplicate | Accept path; allowlist (Simulator reject); Message-ID guard |
| Proposal: refusal recorded; data-only; gas fit | Hub refusal is recorded; Data-only payload; Gas floor and fit |
| Orchestrator security decision: one payer per pair | Payer binding; Invariants |
