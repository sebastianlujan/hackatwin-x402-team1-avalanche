# Spike: Teleporter and ICTT facts at icm-services 34deb30f (PR 1)

Verified on 2026-11-04 against a clone of `ava-labs/icm-services` at commit
`34deb30f7ddb4e6fecfd1132b413d09570610851`, two plain anvils (31337, 31338, `--hardfork cancun`), forge 1.5.1.
Code: `e2e/protocol/src/local/spike-teleporter.ts` (PR #236).

## Verdict (gate passed)

| Method | Result |
|---|---|
| A: impersonate the v1 deployer `0x618FEdD9A45a8C456812ecAAE70C671c6249DfaC` at nonce 0, deploy the clone's build | Works. CREATE yields `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` on both chains; code is non-empty; one message relays hub to L1 and `messageReceived(id)` is true on the L1 |
| B: keyless raw tx | Not needed. The v1.0.0 release asset is not in the clone. `tests/utils/UniversalTeleporterDeployerTransaction.txt` is a different release: sender `0xB845be8F...`, creates `0x68D42653...`, so it cannot give the canonical address |
| C: deploy elsewhere, `anvil_setCode` | Not needed |

PR 7 promotes method A to `teleporter.ts`. No spec change is needed. The deployer needs only a small balance (the spike
used 1 ETH) because the transaction sets its own gas.

Deployed code differs from the v1.0.0 `alloc` in the clone README (24,616 vs 26,028 hex chars: the clone builds with
solc 0.8.30, v1.0.0 used an older compiler). Only the address is canonical; behavior is the pinned build's.

## Foundry and build

- Foundry root is the clone root (`foundry.toml` there, `src = 'icm-contracts/avalanche/'`, `out = 'out'`). Run `forge build` with cwd = clone root.
- solc `0.8.30`, `evm_version = 'shanghai'` (our `packages/contracts` uses 0.8.30 and `cancun`; the clone's artifacts run on a cancun anvil).
- Submodules (3): `lib/forge-std`, `lib/openzeppelin-contracts-upgradeable`, `lib/solidity-merkle-trees`. `git submodule update --init --recursive --depth 1` works after a shallow fetch by SHA.
- Linking: no library placeholders (`__$`) in `TeleporterMessenger`, `ERC20TokenHome`, `ERC20TokenRemote` creation code, so no linking step.
- Artifacts used: `out/TeleporterMessenger.sol/TeleporterMessenger.json`, `out/ERC20TokenHome.sol/`, `out/ERC20TokenRemote.sol/`, `out/TeleporterRegistry.sol/`.

## ICTT constructors and structs

- `ERC20TokenHome(address teleporterRegistryAddress, address teleporterManager, uint256 minTeleporterVersion, address tokenAddress, uint8 tokenDecimals)`
- `ERC20TokenRemote(TokenRemoteSettings settings, string tokenName, string tokenSymbol, uint8 tokenDecimals)`
- `TokenRemoteSettings { address teleporterRegistryAddress; address teleporterManager; uint256 minTeleporterVersion; bytes32 tokenHomeBlockchainID; address tokenHomeAddress; uint8 tokenHomeDecimals; }`
- `TeleporterRegistry(ProtocolRegistryEntry[] initialEntries)` with `ProtocolRegistryEntry { uint256 version; address protocolAddress; }`; its constructor reads `getBlockchainID()` from the Warp address, so the stub must be in place first.
- `registerWithHome(TeleporterFeeInfo feeInfo)` on the remote, with `TeleporterFeeInfo { address feeTokenAddress; uint256 amount; }`; reverts "already registered" on a second call.
- Registered-remote view: `getRemoteTokenTransferrerSettings(bytes32 remoteBlockchainID, address remote)` on the home, returning `RemoteTokenTransferrerSettings { bool registered; uint256 collateralNeeded; uint256 tokenMultiplier; bool multiplyOnRemote; }`. Event `RemoteRegistered(bytes32 indexed remoteBlockchainID, address indexed remoteTokenTransferrerAddress, uint256 initialCollateralNeeded, uint8 tokenDecimals)`.
- `SendTokensInput { bytes32 destinationBlockchainID; address destinationTokenTransferrerAddress; address recipient; address primaryFeeTokenAddress; uint256 primaryFee; uint256 secondaryFee; uint256 requiredGasLimit; address multiHopFallback; }`
- `SendAndCallInput { bytes32 destinationBlockchainID; address destinationTokenTransferrerAddress; address recipientContract; bytes recipientPayload; uint256 requiredGasLimit; uint256 recipientGasLimit; address multiHopFallback; address fallbackRecipient; address primaryFeeTokenAddress; uint256 primaryFee; uint256 secondaryFee; }`
- `send(SendTokensInput input, uint256 amount)` and `sendAndCall(SendAndCallInput input, uint256 amount)`.
- ICTT events: `TokensSent(bytes32 indexed teleporterMessageID, address indexed sender, SendTokensInput input, uint256 amount)`, `TokensAndCallSent(...)` (same shape with `SendAndCallInput`), `CallSucceeded(address indexed recipientContract, uint256 amount)`, `CallFailed(address indexed recipientContract, uint256 amount)`, `TokensWithdrawn(address indexed recipient, uint256 amount)`.

## Teleporter

- `TeleporterMessageInput { bytes32 destinationBlockchainID; address destinationAddress; TeleporterFeeInfo feeInfo; uint256 requiredGasLimit; address[] allowedRelayerAddresses; bytes message; }`
- `TeleporterMessage { uint256 messageNonce; address originSenderAddress; bytes32 destinationBlockchainID; address destinationAddress; uint256 requiredGasLimit; address[] allowedRelayerAddresses; TeleporterMessageReceipt[] receipts; bytes message; }`
- Events: `SendCrossChainMessage(bytes32 indexed messageID, bytes32 indexed destinationBlockchainID, TeleporterMessage message, TeleporterFeeInfo feeInfo)`, `ReceiveCrossChainMessage(bytes32 indexed messageID, bytes32 indexed sourceBlockchainID, address indexed deliverer, address rewardRedeemer, TeleporterMessage message)`, `MessageExecuted(bytes32 indexed messageID, bytes32 indexed sourceBlockchainID)`, `BlockchainIDInitialized(bytes32 indexed blockchainID)`; a failed execution emits `MessageExecutionFailed`.
- `receiveCrossChainMessage(uint32 messageIndex, address relayerRewardAddress)` reads `getVerifiedWarpMessage(messageIndex)` and requires `originSenderAddress == address(this)`, so the stub injects the hub Teleporter address as origin sender. The destination address may be an EOA (the message still counts as received).
- Teleporter has no constructor arguments; its two reentrancy-lock storage slots are set by the constructor, which is why method A deploys initcode instead of copying code.

## Warp: upstream struct vs `WarpMessengerStub` (batch 1 deviation note)

- Upstream `IWarpMessenger` (`icm-contracts/avalanche/subnet-evm/IWarpMessenger.sol`): `struct WarpMessage { bytes32 sourceChainID; address originSenderAddress; bytes payload; }`. The stub's struct has the same fields in the same order: ABI compatible, confirmed by the passing round trip.
- Event differs on purpose: upstream `SendWarpMessage(address indexed sender, bytes32 indexed messageID, bytes message)`, stub `WarpMessageSent(bytes32 indexed messageID, bytes message)`. Teleporter does not read it; the relay (PR 8) reads the stub's event (design D7). No stub change is needed.
- `sendWarpMessage(bytes) returns (bytes32)`, `getBlockchainID()` and `getVerifiedWarpMessage(uint32) returns (WarpMessage, bool)` match the stub.

## Process

Fetched and built only `ava-labs/icm-services` at the pinned commit into the gitignored `.cache/`, run only against loopback anvils. No tracked file carries the ecosystem SPDX header (the license guard test passes on the repository).
