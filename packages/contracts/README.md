# @hackatwin/contracts

Foundry project for `PaymentHub`, `IcttMessenger`, `SettlementReceiver` and `PaymentBroker`.
Solidity 0.8.30, `evm_version = 'cancun'`. Dependencies come from pnpm only (no submodules, no `forge install`).

## Tools

Install the pinned tools once:

```bash
cargo install bulloak --version 0.9.2 --locked
cargo install lintspec --version 0.20.0 --locked
```

`lintspec` 0.20.0 needs Rust 1.98; on older toolchains use the release binary from
<https://github.com/beeb/lintspec/releases/tag/v0.20.0>. Foundry is pinned to `v1.5.1` in CI.

## Commands

Run from `packages/contracts`:

| Command | Purpose |
|---|---|
| `forge build` and `forge test` | Compile and test |
| `forge fmt --check` | Format check (Wonderland settings) |
| `pnpm test:bulloak:scaffold` | Scaffold tests from `.tree` files |
| `pnpm test:bulloak:check` | Fail when a tree and its test drift |
| `pnpm lint:sol` and `pnpm lint:spec` | solhint and lintspec |
| `FOUNDRY_PROFILE=deep forge test` | Deep fuzz and invariant run (nightly in `contracts-nightly.yml`) |
| `forge snapshot --check --tolerance 1 --match-path 'test/gas/*'` | Gas drift check; refresh with `forge snapshot --match-path 'test/gas/*'` |

## Gas

Measured with `forge snapshot` on `test/gas` (cold storage, whole test body, `.gas-snapshot`). `dispatch` includes the
test messenger, so it is an upper bound for the hub work.

| Path | Gas |
|---|---|
| `pay` (local lane, first payment) | 92795 |
| `pay` (cross-chain lane, first payment) | 92761 |
| `settle` (no callback) | 54652 |
| `dispatch` (test messenger) | 210513 |
| `refund` | 41394 |
| `settle` then `withdraw` | 75835 |

Nothing in this project broadcasts transactions.
