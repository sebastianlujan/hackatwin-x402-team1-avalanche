# Delta for decision-log

## ADDED Requirements

### Requirement: Step 0 drift recorded

`docs/decisions.md` MUST record every row of PLAN "Drift since decisions.md" with the "Now" value and its plan
pointer: CCIP Sepolia to Fuji (status MAINTENANCE, last success 2026-11-02, check in T12.2), validator image (pin
`v1.15.2`, T6.3), C-Chain execution (async, pick `N` behind the head, T5.1), ICM license (Ecosystem License 1.1,
sign-off O7), backup RPC (recent state only), and x402-rs (Permit2 format differs from `@x402/evm`, T11.3).

#### Scenario: Required items present

- Given `docs/decisions.md` after T1.7
- When searched for CCIP lane, validator image, ICM license, backup RPC, and x402-rs
- Then each has an entry matching the PLAN "Now" column

#### Scenario: Still-unverified items not promoted

- Given PLAN "Still unverified"
- When `docs/decisions.md` is read
- Then none of those items is marked verified

### Requirement: Refund open point closed

The refund open point MUST be marked closed with a link to `standards/smart-contracts.md#2-state-pattern` and the
verified ICTT allowance sweep.

#### Scenario: Closed with link

- Given the "Open points" section of `docs/decisions.md`
- When the refund entry is read
- Then it is marked closed and links to `standards/smart-contracts.md#2-state-pattern`

### Requirement: Overview label fix tracked

The overview label fix MUST be recorded as tracked by T3.5 and MUST NOT be performed in T1.7.

#### Scenario: Pointer only

- Given the T1.7 diff
- When reviewed
- Then a note points to T3.5 and no overview file is edited

### Requirement: No decision changed

T1.7 MUST NOT alter any decision ID, chosen value, or verified address.

#### Scenario: Diff check

- Given the T1.7 diff
- When reviewed
- Then no decision value or address line is modified, only drift status entries are added or closed

### Requirement: Links resolve

Added links MUST resolve in the docs build.

#### Scenario: Build passes

- Given the docs build
- When it runs on a branch containing T1.7
- Then it reports no broken links

## Traceability

| PLAN T1.7 checkbox | Requirement |
|---|---|
| CCIP lane, validator image, ICM license, backup RPC, x402-rs recorded | Step 0 drift recorded |
| Refund open point closed with link to standards section 2 | Refund open point closed |
| Overview label fix tracked by T3.5 | Overview label fix tracked |
