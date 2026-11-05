---
title: Twin Finance contracts
sidebar_position: 2
---

# Twin Finance + DAMM Capital contracts (reference)

> ⚠️ UNVERIFIED. Compiled from a third-party AI summary of @DAMM_Capital and @twinfinance_ posts (Sep/Oct 2026),
> Dune, and Twin's on-chain registry. Verify every address on Arbiscan and against Twin's official registry
> before use. Mainnet contracts. The demos use them **read-only**; no funds move.

## Tokens (Arbitrum, chainId 42161)

| Token | Currency | Address |
|---|---|---|
| ARGt | Argentine peso | `0x59863989d080b22476db95656d0c3cc18be92214` |
| BRAt | Brazilian real | `0xc4ed6aba5373d78e160f4df39e011f078be54df8` |
| COLt | Colombian peso | `0xa16d5db80a45157e0e451750b81ff0cc0b61d558` |
| PERt | Peruvian sol (PERt, not PENt) | `0x899438713f62b04d6cd8e8709986f7256fb6e3d9` |
| MEXt | Mexican peso | `0xb96aa6babccd738d6644add4912fe5efbebf5a25` |
| BOLt | Bolivian boliviano | `0x1edf5e61b6a4fe19fef3a695328f61aaa07728ea` |
| CHLt | Chilean peso | `0xe8dbc4680235ccaeff48e4c0b0eaceebb89e5e17` |

Twin's registry reportedly also lists deployments on Base, Ethereum, Polygon, and Avalanche. TODO: fetch the
Avalanche addresses from the official registry.

## Curve FX pools (Arbitrum, vs USD₮0) — published by DAMM Capital

| Pair | Pool |
|---|---|
| ARGt / USD₮0 | `0x356d349da9add7efb56a35fab939a2c6d852f853` |
| BRAt / USD₮0 | `0xeef48df5f1c509cd9730774b4e8a4464626ef8d5` |
| COLt / USD₮0 | `0x7d2dffa9e903b8377c96196da424c7965b06bcc3` |
| MEXt / USD₮0 | `0x6edbf3ada7b6d9524c3248955538d573aae449cf` |
| PERt / USD₮0 | `0x41af8cc0811dd07f167752b821cf5b11dba7ca85` |
| BOLt / USD₮0 | `0x9c7809c813bcc67e288c56d5ce5e0225996bfcd2` |
| CHLt / USD₮0 | reported live; address missing (TODO) |

## Morpho vaults (Arbitrum) — curated by DAMM Capital, via Monarchlend

| Token | Vault |
|---|---|
| ARGt | `0x9Dd3F844747AB78d616BF76DB92756E17A064aDD` / `0x207396cbe2f6f50670eaa69584c9f723924c7fe9` ⚠️ two addresses |
| BRAt | `0x9Dd3F844747AB78d616BF76DB92756E17A064aDD` ⚠️ same as ARGt; likely wrong |
| COLt | `0x596FD4C6cAb1aeBCe2a847773Ca87F24349D0c56` |
| MEXt | `0x3046bc254bD2269eC5C3478692be619441Bb11A5` |
| PERt | `0x5eD1aeFACb3B6CCC3F924B1d8915754Ed780266F` |

Isolated Morpho borrow markets exist (e.g. PERt, MEXt, and COLt vs USDC / USD₮0). Example market ID:
PERt vs USD₮0 = `0xf8d3f09b4df2a1f8a500117c3d73ebbe561c5af708e282a174952826f28ec00f`.

## Notes

- DAMM Capital is the curator/allocator of the Morpho vaults; Merkl rewards apply to several of them.
- The Curve pools are for spot FX (LATAM stables vs USD₮0).
- Prices come via DIA oracles (executable market FX, not official rates, plus guardians).
- Compliance: Twin positions its stablecoins as payment instruments without yield. Showing Morpho yield in a
  Twin-co-branded demo needs explicit approval from Twin.
