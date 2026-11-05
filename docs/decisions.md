---
title: Decisions
sidebar_position: 2
---

# Decisions

The single source for design decisions and verified facts. Other docs link here instead of repeating details.
Anything not listed under [Verified facts](#verified-facts) is **to be verified** before use.

## Decision log

| ID | Decision | Why |
|---|---|---|
| Q1 | **Hybrid architecture.** On-chain: one immutable `PaymentHub` singleton per chain, built with Morpho Blue patterns (no proxies, lanes by `Id = keccak256(LaneParams)`, owner-enabled plug-ins, EIP-712 authorization with an agent budget cap, callbacks), used by Demos 2 and 3. Off-chain: one hexagonal package per demo, with repo-wide DI (composition roots, typed config profiles). | One small core per chain, demos stay small and teachable, and config swaps adapters with no code change. Morpho Blue is GPL-2.0-or-later: we borrow patterns only, never code. |
| Q2 | All three demos must work and be didactic. Demo 1 is live. Demos 2 and 3 are live with a recorded fallback. | Demo 1 runs on a local fork. Demos 2 and 3 depend on testnets, a relayer, and CCIP latency. |
| Q3 | About 2 weeks of scope. In: the devcontainer. Out: the Morpho vault view. The alternative architecture is a document only. | Fits the talk date. Showing yield in a Twin co-branded demo needs Twin's approval. |
| Q4 | Demo 1 has no custom contract: pure x402. | The lesson is HTTP 402 plus a stablecoin. Fewer moving parts on stage. |
| Q5 | The Demo 1 agent is an EOA with an off-chain budget policy (`AgentPolicy` port). The on-chain budget cap lives in the `PaymentHub` authorization (Demos 2 and 3). | Demo 1 has no contract (Q4). On-chain enforcement goes where a contract already exists. |
| Q6 | *Superseded by C1 and Q17.* Demo 1 was going to charge real ARGt on C-Chain mainnet. | "No mainnet" ruled it out; the fork keeps real ARGt without real funds. |
| Q7 | Demo 2 runs on Fuji testnet: TwinPay L1, CCIP Sepolia → Fuji, and ICTT Fuji → L1 with Circle testnet USDC. | Shows both cross-chain stacks: CCIP into Avalanche, ICM/ICTT into the L1. No ARGt exists on any testnet. |
| Q8 | *Superseded by Q18.* LayerZero was going to fund the agent with ARGt from Arbitrum. | Twin's LayerZero route exists only on mainnet. |
| Q9 | **Devcontainer**: upstream `trailofbits/claude-code-devcontainer`, extended with Foundry, pnpm, bulloak, and lintspec, with the firewall allowlist enabled (Anthropic API, GitHub, npm, Avalanche and Arbitrum RPCs, MCP hosts). | It runs Claude Code with `bypassPermissions` and open outbound network by default; the firewall limits what an agent can reach. |
| Q10 | *Superseded by Q20.* A capped hot wallet for mainnet funds. | No mainnet funds remain; a fresh key and keystores are enough. |
| Q11 | **Self-hosted official x402 TypeScript facilitator** (`@x402/core` + `@x402/evm`, registering `eip155:43114`, Fuji, and the L1). x402 `exact` scheme with `assetTransferMethod: "permit2"` for ARGt. The payer does a one-time `approve(Permit2)`. The facilitator wallet needs gas. PayAI is an optional alternative adapter. Fallback: x402-rs (Docker). | ARGt has no permit and no ERC-3009, so Permit2 is the only transfer method that works. A public facilitator cannot reach a local fork or a custom L1. |
| Q12, Q16 | **Pricing.** The API is priced in USD and converted to ARGt in real time by `GuardedOracle`, a decorator implementing `PriceOracle`. Primary: `CurvePoolOracle` (Curve ARGt/USD₮0 pool on Arbitrum, `price_oracle()`). Guard: `ChainlinkFeedOracle` (Chainlink ARS/USD on Base, `latestRoundData`). Use Curve when it is within ±2% of Chainlink; otherwise use Chainlink and flag it. The quote is frozen for about 30 s in the 402 (`validUntil`). `pnpm quote` reuses the same adapters. | Curve is the executable ARGt market but thin. Chainlink guards against a manipulated pool. A frozen quote keeps verify and settle consistent. |
| Q13 | Demo 3 runs on TwinPay L1 (Fuji). The agent receives USDC via ICTT (Demo 2) and pays via x402 Permit2 on the L1 (Demo 1 flow). The price is shown in ARGt via the same oracle. Fallback profile: Fuji C-Chain + Circle USDC (ERC-3009). | Proves composition: same code, different config profile. |
| Q14 | Value moves with ICTT `sendAndCall`: token plus payment instruction in one ICM message to `SettlementReceiver` on the L1, which implements `IERC20SendAndCallReceiver.receiveTokens` and pulls the tokens with `transferFrom`. | Token and instruction arrive together, so there is no second message to match. |
| Q15 | **L1 genesis**: own gas token, low fixed fees, Transaction AllowList precompile, `warpConfig.requirePrimaryNetworkSigners: true`, the Arachnid deterministic deployer preallocated, and EVM `cancun`. | Only registered agents transact. Verifying C-Chain messages requires primary network signers (platform-cli does not set it). The deployer lets Permit2 and the x402 proxy land at their canonical addresses. Avalanche has no Prague. |
| Q17 | **Demo 1 runs on a local anvil fork of Avalanche C-Chain mainnet** with the real ARGt contract. The agent gets a balance by calling the real `mint(address,uint256)` while impersonating Twin's LayerZero adapter, which holds `MINTER_BURNER_ROLE`. We ask Twin to deploy official ARGt on Fuji; if they do, Demos 2 and 3 switch the asset to ARGt via config. | Real ARGt bytecode and roles, with no mainnet transaction and no mock token. |
| Q18 | LayerZero is not in the code. The talk mentions it as how real ARGt moves across chains in production (Twin's OFT adapter). | Out of demo scope, still worth explaining. |
| Q19 | **Infra is self-hosted** with `docker-compose` in `infra/`: one validator node and one ICM relayer on a small VM (2 vCPU, 4 GB RAM, 100 GB disk). Builder Hub managed testnet nodes and relayer only for quick experiments. | Managed testnet nodes expire after 3–7 days, and the L1 halts when its validator expires. |
| Q20 | The agent wallet on the fork is a fresh key never funded on mainnet. Keys live in encrypted keystores (`cast wallet import`). | The fork keeps chain ID 43114, so signatures made on the fork are valid on mainnet. A key with no mainnet funds has nothing to replay. |

### Cross-cutting decisions

| ID | Decision | Why |
|---|---|---|
| C1 | **No mainnet transactions, no mocks.** Reading mainnet price data off-chain is fine. Demo 1 transacts only on the local fork. Unit tests may still fake ports through DI and use Chainlink Local's CCIP simulator. | Real contracts on stage, zero mainnet risk. |
| C2 | **CCIP** on the Sepolia → Fuji lane with `@chainlink/contracts-ccip@2.0.0`. Build extraArgs with `ExtraArgsCodec._getBasicEncodedExtraArgsV3(gasLimit, bytes4(0))`. Fees in native (`feeToken = address(0)`) or LINK. | The lane is active. CCIP 2.0 deprecates `allowOutOfOrderExecution`. |
| C3 | **ERC-8004** official registries for agent identity and reputation. Register with `register(string agentURI)`. The Validation registry is not used. | Official deployments exist on Avalanche mainnet (present on the fork) and Fuji. The Validation registry is not finalized. |
| C4 | **Contract stack**: Wonderland boilerplate conventions (`dev` branch), our gitflow (`feature/`), and repo-root hooks, commitlint, and CI. MockARGt is removed. | A strict, proven standard. Details in [Smart contract standards](standards/smart-contracts.md). |
| C5 | **State machines**: one per entity, a single write path, and a pure transition table. | Every state change is checked and observable. Details in [Smart contract standards](standards/smart-contracts.md#2-state-pattern). |
| C6 | **Agent tooling**: vendor `chainlink-ccip-skill` and `chainlink-data-feeds-skill` from `smartcontractkit/chainlink-agent-skills`. Reject `chainlink-for-agents`. Add the OpenZeppelin MCP. | `chainlink-for-agents` is a hosted gateway that pays USDC on Base mainnet and has no Fuji, L1, or ICM support. |

### Open points

- Fork block number `N` for Demo 1, and the TwinPay L1 chain ID: chosen during implementation.
- Sepolia side of Demo 2: the agent sends the CCIP message from its EOA or through a minimal sender contract.
- Refund function for funds rejected on the L1 (`SettlementReceiver` → `Rejected`).
- License of the vendored ICM interfaces (`ava-labs/icm-services`): to be verified before vendoring.
- Backup C-Chain RPC: unverified.

## Verified facts

Verified as of 2026-11-04. Re-check on-chain values before a deploy or a talk rehearsal.

### Twin and ARGt

| Fact | Value | Source |
|---|---|---|
| Official registry chains | Base, Polygon, Arbitrum, Ethereum. No Avalanche, no testnets. | https://docs.twin.finance/stablecoins/supported-chains, https://docs.twin.finance/stablecoins/contracts |
| ARGt on Avalanche C-Chain (not in the registry) | `0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B` (BeaconProxy; beacon `0x59863989d080b22476db95656d0c3cc18be92214`; deployer `0x3f5c58f0b2400cd82ea7ea6c3b5794a1228f3df9`) | https://snowtrace.io/address/0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B |
| ARGt interface | `TwinToken` = ERC20Upgradeable + AccessControlUpgradeable + ERC2771Context. No permit, no ERC-3009. | Verified source on the explorer above |
| ERC-2771 forwarder (C-Chain, OpenGSN) | `0x2e3e3c36a5d01ccf4637cf9624c9d1033e337ea1` | https://snowtrace.io/address/0x2e3e3c36a5d01ccf4637cf9624c9d1033e337ea1 |
| Minter on C-Chain | Twin's LayerZero adapter `0x4821FBf47B261F0D52Ba0F941CF67b8648f82691` holds `MINTER_BURNER_ROLE` | https://snowtrace.io/address/0x4821FBf47B261F0D52Ba0F941CF67b8648f82691 |
| ARGt on testnets | None. Twin's deployer has nonce 0 on Sepolia, Arbitrum Sepolia, Base Sepolia, Amoy, and Fuji. | Explorers for each network |
| Lookalikes **not** issued by Twin | Sepolia `0x5bC627379b6b961A8c8480bC4C32b98c12a9373B`, Base Sepolia `0xaA4C6c348566e4A1EF947aCe1C37b5de4416D285` | Explorers; Twin's registry |
| Address reuse | Twin's Arbitrum token addresses on Avalanche hold different symbols with zero supply. Never reuse an address across chains. | Explorers |

More context: [Twin Finance contracts](references/twin-finance-contracts.md).

### x402

| Fact | Value | Source |
|---|---|---|
| Facilitator packages | `@x402/core@2.29.0` + `@x402/evm@2.29.0`. `x402Facilitator` from `@x402/core/facilitator`, `ExactEvmScheme` from `@x402/evm/exact/facilitator`. | https://github.com/coinbase/x402, https://www.npmjs.com/package/@x402/core, https://www.npmjs.com/package/@x402/evm |
| Permit2 (C-Chain and Fuji) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` (hardcoded in `@x402/evm`) | https://github.com/Uniswap/permit2 |
| x402 exact Permit2 proxy (C-Chain and Fuji) | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` (hardcoded in `@x402/evm`) | https://github.com/coinbase/x402 |
| Fallback facilitator | x402-rs (Docker) | https://github.com/x402-rs/x402-rs (to be verified) |

### Pricing

| Fact | Value | Source |
|---|---|---|
| Curve ARGt/USD₮0 pool (Arbitrum) | `0x356d349da9add7efb56a35fab939a2c6d852f853`, `price_oracle()` ≈ 1658 ARGt per USD₮0; thin pool (≈ $29.6k) | https://arbiscan.io/address/0x356d349da9add7efb56a35fab939a2c6d852f853 |
| Chainlink ARS/USD (Base) | `0xaf992a6ad37b4878cF9c31f082B178860e268cE3`, `latestRoundData`, 24 h heartbeat, 0.5% deviation | https://docs.chain.link/data-feeds/price-feeds/addresses |
| Chainlink Data Streams USD/ARS (optional future adapter) | Feed ID `0x000848d3adb3429cb99a6392b6679fc45852536a17f3353356825c4eb282c765`, verifiable on Avalanche, needs credentials | https://docs.chain.link/data-streams |
| Other providers | Pyth: no ARS feed. DIA: ARS/USDT on Arbitrum only. | Provider catalogs |
| Reference rates (2026-11-04) | ARGt tracks the dólar cripto/CCL rate (≈ 1658), about 5.6% above the official rate (≈ 1570) | Curve pool and Chainlink feed above |

### Avalanche, ICM, and the L1

| Fact | Value | Source |
|---|---|---|
| C-Chain public RPC (serves historical state) | `https://api.avax.network/ext/bc/C/rpc` (backup `https://avalanche-c-chain-rpc.publicnode.com`, unverified) | https://build.avax.network/docs |
| Fork command (Demo 1) | `anvil --fork-url https://api.avax.network/ext/bc/C/rpc --fork-block-number <N> --chain-id 43114` | Foundry |
| Circle testnet USDC (Fuji) | `0x5425890298aed601595a70AB815c96711a31Bc65` | https://developers.circle.com/stablecoins/usdc-contract-addresses |
| ICM / ICTT source | `ava-labs/icm-services` (the `icm-contracts` repo is archived). Vendor interfaces only. | https://github.com/ava-labs/icm-services |
| ICTT receiver | `IERC20SendAndCallReceiver.receiveTokens(bytes32 sourceBlockchainID, address originTokenTransferrerAddress, address originSenderAddress, address token, uint256 amount, bytes payload)`. The transferrer approves the receiver, which pulls with `transferFrom`. | https://github.com/ava-labs/icm-services |
| `SendAndCallInput` fields | `destinationBlockchainID`, `destinationTokenTransferrerAddress`, `recipientContract`, `recipientPayload`, `requiredGasLimit`, `recipientGasLimit` (< `requiredGasLimit`), `multiHopFallback`, `fallbackRecipient`, `primaryFeeTokenAddress`, `primaryFee`, `secondaryFee` | https://github.com/ava-labs/icm-services |
| Teleporter messenger | `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` | https://github.com/ava-labs/icm-services |
| Deterministic deployer (L1 genesis) | `0x4e59b44847b379578588920cA78FbF26c0B4956C`, 69-byte runtime `0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3` | https://github.com/Arachnid/deterministic-deployment-proxy |
| Permit2 CREATE2 salt | `0x0000000000000000000000000000000000000000d3af2663da51c10215000000` (deploy via `forge script`) | https://github.com/Uniswap/permit2 |
| x402 proxy deploy script | `contracts/evm/script/Deploy.s.sol` | https://github.com/coinbase/x402 |
| `warpConfig.requirePrimaryNetworkSigners` | Must be `true` to verify C-Chain messages on the L1; platform-cli does not set it | https://build.avax.network/docs |
| EVM version | `cancun`. Avalanche has no Prague; set `evm_version = "cancun"` explicitly because solc 0.8.30 defaults to `prague`. | https://build.avax.network/docs |
| Validator image | `avaplatform/subnet-evm` (Fuji ≥ v1.15.0; the console pins v1.15.0-fuji, the docs list v1.15.2) with `AVAGO_NETWORK_ID=fuji`, `AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true`, `AVAGO_TRACK_SUBNETS=<id>`, ports 9650/9651 | https://hub.docker.com/r/avaplatform/subnet-evm |
| Relayer image | `avaplatform/icm-relayer` v1.8.3, configured from `sample-relayer-config.json` | https://hub.docker.com/r/avaplatform/icm-relayer |
| Managed testnet nodes | Max 3 nodes, TTL 3–7 days; the L1 halts if its validator expires | https://build.avax.network/console/testnet-infra/nodes |
| Managed ICM relayer | TTL 3 days | https://build.avax.network/console/testnet-infra/icm-relayer |

### CCIP (Sepolia → Fuji, active)

| Chain | Router | Chain selector | LINK |
|---|---|---|---|
| Ethereum Sepolia | `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59` | `16015286601757825753` | `0x779877A7B0D9E8603169DdbD7836e478b4624789` |
| Avalanche Fuji | `0xF694E193200268f9a4868e4Aa017A0118C9a8177` | `14767482510784806043` | `0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846` |

Source: https://docs.chain.link/ccip/directory/testnet. Package: `@chainlink/contracts-ccip@2.0.0`
(https://www.npmjs.com/package/@chainlink/contracts-ccip).

### ERC-8004

| Registry | Avalanche mainnet (present on the fork) | Fuji |
|---|---|---|
| Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

`register(string agentURI) returns (uint256 agentId)` emits
`Registered(uint256 indexed agentId, string agentURI, address indexed owner)`. The Validation registry is not
finalized. Source: https://github.com/erc-8004/erc-8004-contracts.

### Contracts tooling

| Fact | Value | Source |
|---|---|---|
| OpenZeppelin Contracts | `5.7.0` is the final release (the npm `latest` tag still points to 5.6.1) | https://github.com/OpenZeppelin/openzeppelin-contracts/releases/tag/v5.7.0 |
| OpenZeppelin MCP | `https://mcp.openzeppelin.com/contracts/solidity/mcp`: 8 generators, targets OZ ^5.7.0, no ERC-3009 option | https://mcp.openzeppelin.com/contracts/solidity/mcp |
| Chainlink packages | `@chainlink/contracts-ccip@2.0.0` (imports OZ 5.3.0), `@chainlink/local@0.3.1` (imports OZ 4.8.3), `@chainlink/contracts@1.5.0` | https://www.npmjs.com/org/chainlink |
| Wonderland boilerplate | `dev` branch: exact `pragma solidity 0.8.30;`, pnpm-only deps, Bulloak, lintspec | https://github.com/defi-wonderland/solidity-foundry-boilerplate/tree/dev |
| Devcontainer | Trail of Bits upstream. Sets `bypassPermissions` inside the container; outbound network is open unless the firewall is enabled. | https://github.com/trailofbits/claude-code-devcontainer |
| Morpho Blue | GPL-2.0-or-later: patterns only, no code | https://github.com/morpho-org/morpho-blue |
| Chainlink agent skills | `chainlink-ccip-skill`, `chainlink-data-feeds-skill` (MIT), vendored at commit `d907b451ce36a510db3a6ad19e6b76c9e763175d` | https://github.com/smartcontractkit/chainlink-agent-skills |
