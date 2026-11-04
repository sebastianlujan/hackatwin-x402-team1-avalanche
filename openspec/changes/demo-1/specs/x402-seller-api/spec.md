# x402 Seller API Specification

## Purpose

Hono API selling an ARS FX quote priced in USD, charged in ARGt (Q12, Q16).

## Requirements

### Requirement: USD to ARGt money parser

The route MUST convert its USD price to an ARGt `AssetAmount` through `GuardedOracle` with `assetTransferMethod: 'permit2'`.

#### Scenario: Convert
- GIVEN price 0.01 USD and the oracle at 1658.3 ARGt per USD
- WHEN a request arrives without payment
- THEN the 402 amount equals the converted base units

#### Scenario: Oracle error
- GIVEN the oracle throws
- WHEN a request arrives
- THEN the API answers 5xx and issues no 402

### Requirement: 402 requirements

Requirements MUST set `maxTimeoutSeconds: 30` and MUST show the rate source (`Curve` or `Chainlink`, guarded flag).

#### Scenario: 402 body
- GIVEN an unpaid request
- WHEN the API answers
- THEN status is 402, `maxTimeoutSeconds` is 30, and the rate source is present

### Requirement: Paid response

After settlement the API MUST return 200 with the quote, its sources, and the text "market rate, not official".

#### Scenario: Paid
- GIVEN a valid payment
- WHEN settled
- THEN the body carries the quote, sources, and the disclaimer

#### Scenario: Failed settlement
- GIVEN settlement fails
- WHEN the API responds
- THEN no 200 and no quote body is returned

## Traceability

| Done-when box | Requirement |
|---|---|
| T5.4 money parser with `permit2` | USD to ARGt money parser |
| T5.4 `maxTimeoutSeconds: 30`, rate source | 402 requirements |
| T5.4 paid response contents | Paid response |
