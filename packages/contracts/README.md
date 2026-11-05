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
| Receiver `receiveTokens`, settled, merchant without code | 112035 |
| Receiver `receiveTokens`, settled, succeeding callback | 183813 |
| Receiver `receiveTokens`, rejected | 52065 |
| Receiver settled then `withdraw` | 108436 |
| Broker `ccipReceive`, accepted (pay and dispatch, test messenger) | 313450 |
| Broker `ccipReceive`, rejected (budget exceeded) | 67128 |

The receiver rows include the first cold write of every slot. The documented `recipientGasLimit` is 300000: the settled
path with a callback must fit it (asserted in `GasSettlementReceiver`), and a delivery that cannot fund the callback cap
(about 131.6k gas left at the callback) reverts so ICTT sends the whole amount to the fallback recipient.

The broker rows include the test messenger, so the real ICTT send adds to the accepted row. The documented CCIP
`gasLimit` for the broker is 800000 (asserted in `GasPaymentBroker`), and `MIN_RELAY_GAS` is 500000: a message that
reaches the hub calls with less gas left reverts `PaymentBroker_InsufficientGas` (re-executable) instead of being
recorded as a final `Rejected`.

## Deploy dry-runs

`script/DeployFuji.s.sol` (hub, messenger, broker) and `script/DeployL1.s.sol` (receiver) read chain facts from
`../chains/registry` and choices from `script/params/<chainKey>.json` (ADR 0011). Directories are overridable with
`CHAIN_REGISTRY_DIR`, `DEPLOY_PARAMS_DIR` and `DEPLOY_DEPLOYMENTS_DIR`; dry-runs use `test/fixtures`:

```bash
export CHAIN_REGISTRY_DIR=./test/fixtures/registry DEPLOY_PARAMS_DIR=./test/fixtures/params
export DEPLOY_DEPLOYMENTS_DIR=./test/fixtures/deployments
anvil --chain-id 100001 &
forge script script/DeployL1.s.sol:DeployL1 --fork-url http://127.0.0.1:8545
FUJI_FORK=1 forge test --match-contract UnitDeployFuji   # reads Fuji through the registry RPC, sends nothing
```

Every contract is constructed with the deployer as its owner, the `onlyOwner` config runs as the deployer, then the
scripts call `transferOwnership(owner)` unless `owner` equals the deployer. The record holds `pendingOwner` (the zero
address when no transfer is pending). The owner must then call `acceptOwnership()` on the hub, the broker and the
receiver (Ownable2Step) from its own account; until it does, the deployer stays the owner.

The broadcast gate stays closed: no script or workflow enables it, and signers are keystores selected with
`--account <keystore-name>` (never a key in the environment or an argument). Real params arrive with the testnet deploy
(T7.12): until then the committed params files lack the deployer, owner and fallback recipient and a real run reverts
`Deploy_ParamNotFound`, and it reverts `Registry_EntryNotFound` until the L1 and its ICTT pair are registered (M6).

## Verification templates

Reuse the build settings (solc `0.8.30`, `cancun`, optimizer on with 10000 runs). Constructor arguments come from
`cast abi-encode` with the same values the script used (the owner argument is the deployer, ownership moves afterwards).

Fuji, Snowtrace (served by Routescan; its Etherscan-compatible read API answered `getabi` for the Fuji USDC contract on
2026-11-04, a verification submit has not been run):

```bash
forge verify-contract <address> src/PaymentHub.sol:PaymentHub --chain-id 43113 \
  --verifier-url 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan' --etherscan-api-key verifyContract \
  --compiler-version 0.8.30 --evm-version cancun --optimizer-runs 10000 \
  --constructor-args "$(cast abi-encode 'constructor(address)' <deployer>)"
```

L1, Builder Hub verifier (UNVERIFIED: the L1 and its explorer do not exist yet, so this command has never run;
confirm the verifier URL in Builder Hub before use):

```bash
forge verify-contract <address> src/SettlementReceiver.sol:SettlementReceiver --chain-id <l1-chain-id> \
  --verifier custom --verifier-url '<builder-hub-verifier-url>' --verifier-api-key <builder-hub-api-key> \
  --compiler-version 0.8.30 --evm-version cancun --optimizer-runs 10000 \
  --constructor-args "$(cast abi-encode 'constructor(address,bytes32,address,address,address,address)' <args>)"
```

Nothing in this project broadcasts transactions.
