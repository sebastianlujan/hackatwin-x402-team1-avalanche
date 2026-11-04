# Budget Policy Specification

## Purpose

Off-chain `AgentPolicy` with per-payment and total USD caps (Q5).

## Requirements

### Requirement: Caps

The policy MUST deny a payment above the per-payment cap or one that takes cumulative spend above the total cap. A payment equal to a cap MUST be allowed.

#### Scenario: At per-payment cap
- GIVEN per-payment cap 1.00 USD
- WHEN 1.00 USD is requested
- THEN it is allowed

#### Scenario: Above per-payment cap
- GIVEN the same cap
- WHEN 1.01 USD is requested
- THEN it is denied

#### Scenario: Total cap
- GIVEN total cap 2.00 and 1.50 spent
- WHEN 0.50 is requested it is allowed, and 0.51 is denied

### Requirement: Decision events

Each decision MUST emit a `policy.decision` event with allow or deny and its reason (`per_payment_cap`, `total_cap`, `within_budget`). The same event carries `above_max_amount` when the x402 client refuses a 402 ask above `maxAmount` before the policy is consulted.

#### Scenario: Denial
- GIVEN a denied payment
- WHEN decided
- THEN an event carries `deny` and the reason

#### Scenario: Ask above ceiling
- GIVEN a 402 ask above the buyer's `maxAmount`
- WHEN the x402 client checks it
- THEN `policy.decision` carries `deny` and `above_max_amount`, and the policy is not consulted

### Requirement: Caps from profile only

Caps MUST come from the profile; no env var, argument, or tool input MAY override them.

#### Scenario: No override
- GIVEN a tool call carrying a cap value
- WHEN the policy decides
- THEN the cap key is stripped from the input and the profile caps apply

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.6 each decision emits a reason | Decision events |
| T5.6 both caps at and above limit | Caps |
| T5.6 caps from profile only | Caps from profile only |
