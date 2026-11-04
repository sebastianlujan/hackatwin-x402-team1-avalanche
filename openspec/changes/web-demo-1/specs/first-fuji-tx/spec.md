# First Fuji Transaction Specification

## Purpose

`/path/first-tx`: connect an injected wallet, send a small Fuji transaction, open it on the explorer. Covers T10.4
(PRs 9 and 10).

## Requirements

### Requirement: Send a 0.001 AVAX self-transfer

With an injected wallet connected on Fuji (43113), the screen MUST send exactly 0.001 AVAX from the account to itself.
There MUST be no WalletConnect and no server-held key. The flow MUST show idle, awaiting signature, pending,
confirmed, rejected, and failed states.

#### Scenario: Happy path

- GIVEN a connected account on 43113 with balance
- WHEN the user presses Send
- THEN one transaction of 0.001 AVAX to the same address is requested and the confirmed state shows its hash

#### Scenario: Rejected

- GIVEN the wallet rejects the request
- WHEN the flow ends
- THEN a rejected state shows and Send is available again

#### Scenario: No balance

- GIVEN the account balance is below the amount
- WHEN the screen renders
- THEN Send is disabled with a funding hint

### Requirement: Wrong-network states

Send MUST be disabled unless the wallet is on 43113. On another chain, including 43114 and the fork, the screen MUST
show the current chain and a switch action. A rejected or failed switch MUST show an error and keep Send disabled. A
missing wallet MUST show a no-wallet state with the fallback link.

#### Scenario: Mainnet wallet

- GIVEN the wallet is on 43114
- WHEN the screen renders
- THEN Send is disabled and the switch action is shown

#### Scenario: Switch rejected

- GIVEN the user rejects the switch
- WHEN the flow ends
- THEN an error is shown and Send stays disabled

#### Scenario: No wallet

- GIVEN no injected provider
- WHEN the screen renders
- THEN a no-wallet state shows with the pre-sent link

### Requirement: Explorer URL from chains

The explorer link MUST come from the `packages/chains` helper for Fuji and MUST appear only after a hash exists. The
screen MUST NOT hardcode an explorer host.

#### Scenario: After confirmation

- GIVEN a hash on 43113
- WHEN the confirmed state renders
- THEN the link equals the chains helper output for that hash

#### Scenario: Before a hash

- GIVEN the awaiting-signature state
- WHEN rendered
- THEN no explorer link exists

### Requirement: Pre-sent fallback

A committed pre-sent transaction link MUST be offered as a secondary action in every state. When it is not yet set the
screen MUST say so rather than render a broken link.

#### Scenario: Set

- GIVEN a configured pre-sent hash
- WHEN the screen renders in any state
- THEN a link built by the chains helper is present

#### Scenario: Unset

- GIVEN no configured hash
- WHEN rendered
- THEN a "not set yet" note shows and no anchor exists

## Traceability

| Done-when box | Requirement |
|---|---|
| The explorer URL comes from `packages/chains` | Explorer URL from chains |
| A pre-sent transaction link is the fallback | Pre-sent fallback |
| Wrong-network states are handled | Wrong-network states |
| (what) send a small Fuji transaction | Send a 0.001 AVAX self-transfer |
