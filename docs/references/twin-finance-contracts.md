---
title: Twin Finance contracts
sidebar_position: 2
---

# Twin Finance + DAMM Capital contracts (reference)

> **Partially verified (2026-11-04).** Rows marked **Verified** were checked on-chain or against Twin's official
> registry; sources are in [Decisions › Verified facts](../decisions.md#twin-and-argt). Everything else came from a
> third-party AI summary of @DAMM_Capital and @twinfinance_ posts (Sep/Oct 2026) and Dune, and is **to be
> verified**. These are mainnet contracts: the demos only read them, or use them on a local fork. No mainnet
> transaction, ever.

## Official registry

Twin's registry (https://docs.twin.finance/stablecoins/supported-chains and
https://docs.twin.finance/stablecoins/contracts) lists **Base, Polygon, Arbitrum, and Ethereum only**. It lists no
Avalanche deployment and no testnet. **Verified.**

## ARGt on Avalanche C-Chain (chain ID 43114)

An ARGt deployment exists on C-Chain even though the registry does not list it. **Verified.** Demo 1 uses it on a
local fork (Q17).

| Item | Value |
|---|---|
| ARGt (BeaconProxy) | `0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B` |
| Beacon | `0x59863989d080b22476db95656d0c3cc18be92214` |
| Deployer | `0x3f5c58f0b2400cd82ea7ea6c3b5794a1228f3df9` |
| Implementation | `TwinToken` = ERC20Upgradeable + AccessControlUpgradeable + ERC2771Context. **No permit (ERC-2612), no ERC-3009.** x402 must use the Permit2 transfer method. |
| ERC-2771 forwarder (OpenGSN) | `0x2e3e3c36a5d01ccf4637cf9624c9d1033e337ea1` |
| `MINTER_BURNER_ROLE` holder | Twin's LayerZero OFT adapter `0x4821FBf47B261F0D52Ba0F941CF67b8648f82691` |

LayerZero is how real ARGt moves across chains in production. It is a talk topic only, not part of the demo code
(Q18).

## No ARGt on testnets

Twin has no ARGt on any testnet: its deployer has nonce 0 on Sepolia, Arbitrum Sepolia, Base Sepolia, Amoy, and
Fuji. **Verified.** We have asked Twin to deploy official ARGt on Fuji; until then, Demos 2 and 3 use Circle testnet
USDC.

**Warning: lookalike tokens not issued by Twin.** Never use them.

| Network | Address |
|---|---|
| Sepolia | `0x5bC627379b6b961A8c8480bC4C32b98c12a9373B` |
| Base Sepolia | `0xaA4C6c348566e4A1EF947aCe1C37b5de4416D285` |

**Never reuse an address across chains.** Twin's Arbitrum token addresses hold unrelated tokens with different
symbols and zero supply on Avalanche. The same address can be different contracts per chain: `0x5986…2214` is the
ARGt token on Arbitrum (verified on Arbiscan: "Argentine Peso token", 18 decimals, 91 holders) and the ARGt beacon on
Avalanche.

## Tokens (Arbitrum, chain ID 42161) — to be verified

| Token | Currency | Address |
|---|---|---|
| ARGt | Argentine peso | `0x59863989d080b22476db95656d0c3cc18be92214` |
| BRAt | Brazilian real | `0xc4ed6aba5373d78e160f4df39e011f078be54df8` |
| COLt | Colombian peso | `0xa16d5db80a45157e0e451750b81ff0cc0b61d558` |
| PERt | Peruvian sol (PERt, not PENt) | `0x899438713f62b04d6cd8e8709986f7256fb6e3d9` |
| MEXt | Mexican peso | `0xb96aa6babccd738d6644add4912fe5efbebf5a25` |
| BOLt | Bolivian boliviano | `0x1edf5e61b6a4fe19fef3a695328f61aaa07728ea` |
| CHLt | Chilean peso | `0xe8dbc4680235ccaeff48e4c0b0eaceebb89e5e17` |

## Price sources for ARGt

The demos price the API in USD and convert to ARGt with `GuardedOracle` (Q12/Q16).

| Source | Role | Details | Status |
|---|---|---|---|
| Curve ARGt/USD₮0 pool (Arbitrum) `0x356d349da9add7efb56a35fab939a2c6d852f853` | Primary (`CurvePoolOracle`) | `price_oracle()`; thin pool, about $29.6k | **Verified** |
| Chainlink ARS/USD (Base) `0xaf992a6ad37b4878cF9c31f082B178860e268cE3` | Guard (`ChainlinkFeedOracle`) | `latestRoundData`; 24 h heartbeat, 0.5% deviation | **Verified** |
| Chainlink Data Streams USD/ARS, feed ID `0x000848d3adb3429cb99a6392b6679fc45852536a17f3353356825c4eb282c765` | Optional future adapter | Verifiable on Avalanche; needs credentials | **Verified** |
| Pyth | — | No ARS feed | **Verified** |
| DIA | — | ARS/USDT on Arbitrum only | **Verified** |

**Live rate snapshot (2026-11-04):** about **1658 ARGt per USD₮0** on Curve. ARGt tracks the dólar cripto/CCL rate
(about 1658), roughly 5.6% above the official rate (about 1570). The quote is an executable market rate, not the
official one, and the UI says so.

## Other Curve FX pools (Arbitrum, vs USD₮0) — to be verified

Published by DAMM Capital.

| Pair | Pool |
|---|---|
| BRAt / USD₮0 | `0xeef48df5f1c509cd9730774b4e8a4464626ef8d5` |
| COLt / USD₮0 | `0x7d2dffa9e903b8377c96196da424c7965b06bcc3` |
| MEXt / USD₮0 | `0x6edbf3ada7b6d9524c3248955538d573aae449cf` |
| PERt / USD₮0 | `0x41af8cc0811dd07f167752b821cf5b11dba7ca85` |
| BOLt / USD₮0 | `0x9c7809c813bcc67e288c56d5ce5e0225996bfcd2` |
| CHLt / USD₮0 | Reported live; address missing |

## Morpho vaults (Arbitrum) — out of scope, to be verified

Curated by DAMM Capital via Monarchlend. The Morpho vault view is out of scope (Q3); kept for reference only.

| Token | Vault |
|---|---|
| ARGt | `0x9Dd3F844747AB78d616BF76DB92756E17A064aDD` / `0x207396cbe2f6f50670eaa69584c9f723924c7fe9` (two addresses reported) |
| BRAt | `0x9Dd3F844747AB78d616BF76DB92756E17A064aDD` (same as ARGt; likely wrong) |
| COLt | `0x596FD4C6cAb1aeBCe2a847773Ca87F24349D0c56` |
| MEXt | `0x3046bc254bD2269eC5C3478692be619441Bb11A5` |
| PERt | `0x5eD1aeFACb3B6CCC3F924B1d8915754Ed780266F` |

Isolated Morpho borrow markets reportedly exist (for example PERt, MEXt, and COLt vs USDC / USD₮0). Example market
ID: PERt vs USD₮0 = `0xf8d3f09b4df2a1f8a500117c3d73ebbe561c5af708e282a174952826f28ec00f`.

## Notes

- DAMM Capital is reportedly the curator and allocator of the Morpho vaults, with Merkl rewards on several of them.
- Compliance: Twin positions its stablecoins as payment instruments without yield. Showing Morpho yield in a Twin
  co-branded demo needs explicit approval from Twin.
