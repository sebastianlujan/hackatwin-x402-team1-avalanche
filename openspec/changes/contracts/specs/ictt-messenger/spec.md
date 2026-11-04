# ICTT Messenger Specification

## Purpose

`IcttMessenger`, the hub plug-in that moves a dispatched payment to the L1 with ICTT `sendAndCall` (T7.6, Q14).

## Errors and events

Errors (declared in `IIcttMessenger`): `IcttMessenger_OnlyHub(address caller)`, `IcttMessenger_DestinationMismatch(bytes32 destination)`, `IcttMessenger_TokenMismatch(address token)`, `IcttMessenger_ZeroAmount()`, `IcttMessenger_ZeroAddress()`, `IcttMessenger_ZeroBlockchainId()`, `IcttMessenger_InvalidGasLimits(uint256 requiredGasLimit, uint256 recipientGasLimit)`. Event: `PaymentSent(Id indexed id, bytes32 indexed paymentId, address merchant, uint256 amount)`.

## Requirements

### Requirement: Constructor-injected configuration

The constructor MUST take the hub, the token transferrer, the token it is bound to, the destination blockchain ID, the destination transferrer, the receiver (`recipientContract`), `requiredGasLimit`, `recipientGasLimit`, and `fallbackRecipient`, all immutable. It MUST revert `IcttMessenger_ZeroAddress` for any zero address, `IcttMessenger_ZeroBlockchainId` for a zero destination ID, and `IcttMessenger_InvalidGasLimits` for a zero gas limit or when `recipientGasLimit >= requiredGasLimit`. No address or blockchain ID MUST be hardcoded in `src/`.

#### Scenario: Valid config
- GIVEN valid inputs with `recipientGasLimit < requiredGasLimit`
- WHEN deployed
- THEN every value is readable and immutable

#### Scenario: Invalid gas limits
- GIVEN `recipientGasLimit >= requiredGasLimit`, or a zero gas limit
- WHEN deployed
- THEN construction reverts `IcttMessenger_InvalidGasLimits`

#### Scenario: Zero values
- GIVEN a zero hub, transferrer, token, destination transferrer, receiver, or fallback recipient, or a zero destination ID
- WHEN deployed
- THEN each address case reverts `IcttMessenger_ZeroAddress` and the ID case reverts `IcttMessenger_ZeroBlockchainId`

### Requirement: Only the hub sends

`send` MUST revert `IcttMessenger_OnlyHub(caller)` for any caller other than the hub. It MUST revert `IcttMessenger_DestinationMismatch` when the lane destination differs from the configured destination ID, `IcttMessenger_TokenMismatch` when the token differs from the bound token, and `IcttMessenger_ZeroAmount` for zero.

#### Scenario: Non-hub caller
- GIVEN any address other than the hub
- WHEN it calls `send`
- THEN it reverts `IcttMessenger_OnlyHub`

#### Scenario: Foreign destination or token
- GIVEN a lane destination or token that is not the configured one
- WHEN the hub calls `send`
- THEN it reverts `IcttMessenger_DestinationMismatch` or `IcttMessenger_TokenMismatch`

### Requirement: Builds `SendAndCallInput` and sends

On a valid call `send` MUST pull exactly the amount from the hub, approve the transferrer for exactly that amount, and call `sendAndCall` with an input whose fields come only from configuration and the payment: configured destination ID, destination transferrer, receiver, gas limits, `fallbackRecipient`, `multiHopFallback` zero, fee fields zero, and a payload carrying only the payment ID and merchant. The payload MUST NOT contain a raw home-chain amount. After the call the messenger MUST hold zero tokens and zero allowance to the transferrer. It MUST emit one `PaymentSent` per hop with the lane ID, payment ID, merchant, and amount.

#### Scenario: Input fields
- GIVEN a recording test transferrer
- WHEN the hub dispatches a payment
- THEN the captured input equals the configured values and the payload decodes to `(paymentId, merchant)`

#### Scenario: Exact approval, no residue
- GIVEN a test transferrer that mirrors the ICTT allowance sweep (pulls what it needs, forwards, and sweeps any unused allowance to `fallbackRecipient`)
- WHEN `send` completes
- THEN messenger balance and allowance are zero and the transferrer received exactly the amount

#### Scenario: One event
- GIVEN a successful send
- WHEN logs are read
- THEN exactly one `PaymentSent` is emitted

#### Scenario: Transferrer reverts
- GIVEN a transferrer that reverts
- WHEN the hub dispatches
- THEN `send` reverts and no tokens remain in the messenger

## Traceability

| Done-when box | Requirement |
|---|---|
| T7.6 one event per hop | Builds `SendAndCallInput` and sends |
| T7.6 test transferrer mirrors allowance sweep | Builds `SendAndCallInput` and sends |
| T7.6 no address or blockchain ID hardcoded | Constructor-injected configuration |
| Proposal: only hub, destination check, gas-limit validation | Only the hub sends; Constructor-injected configuration |
