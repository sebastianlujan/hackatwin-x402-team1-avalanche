---
name: avalanche
description: "Trigger: Avalanche, Fuji, C-Chain, P-Chain, L1, subnet, ICM, ICTT, Teleporter, platform-cli, x402 on Avalanche, ERC-8004 on Avalanche. Ground Avalanche work in official docs, MCP, and CLI."
license: MIT
metadata:
  author: "sebastianlujan"
  version: "1.0"
---

## Activation Contract

Use for any task touching Avalanche: Primary Network (C/P/X-Chain), Fuji, L1s (subnets), ICM/ICTT/Teleporter,
platform-cli, or x402 / ERC-8004 on Avalanche. No official Avalanche skill package exists; this skill wraps the
official sources.

## Hard Rules

- Never invent addresses, chain IDs, package names, or CLI subcommands. Verify with the MCP
  (`blockchain_get_contract_info`, `docs_search`) or an explorer; mark anything unverified.
- `avalanche-mcp` is read-only: it looks things up, it never signs or sends transactions.
- Testnets only (Fuji, Sepolia, Fuji L1s). Never move mainnet funds.
- platform-cli subcommands and flags: look them up with `cli_lookup_command` / `platform-cli --help`. Never guess.

## Decision Gates

| Need | Source |
|---|---|
| Concept, guide, API page | MCP `docs_search` → `docs_fetch` |
| CLI command | MCP `cli_lookup_command`, then `platform-cli --help` |
| RPC method | MCP `rpc_lookup_method` |
| P-Chain state (subnets, L1s, validators) | MCP `platform_get_*` |
| Node / chain / contract info | MCP `info_*`, `blockchain_*` |
| File in an Avalanche repo | MCP `github_get_file` |
| MCP unavailable | `https://build.avax.network/llms.txt` → `https://build.avax.network/{path}.md` |
| Full docs context (last resort, large) | `https://build.avax.network/llms-full.txt` |

## Execution Steps

1. Confirm `avalanche-mcp` is connected (`.mcp.json`). If not:
   `claude mcp add avalanche-mcp --transport http https://build.avax.network/api/mcp`
2. Resolve every fact through the Decision Gates before writing code or docs.
3. Apply the domain notes below.

### L1 lifecycle (platform-cli)

- Install: `curl -sSfL https://build.avax.network/install/platform-cli | sh`, then `platform-cli --help`.
- Releases: https://github.com/ava-labs/platform-cli/releases
- P-Chain flow: subnet creation → conversion to L1 → validators. Look up each step with `cli_lookup_command`.

### Cross-chain (ICM / ICTT)

- ICM contracts deep dive: https://build.avax.network/docs/cross-chain/icm-contracts/deep-dive.md
  (take contract addresses from the docs, never from memory).
- Console setup: ICM https://build.avax.network/console/icm/setup, ICTT https://build.avax.network/console/ictt/setup
- CCIP→ICM pattern (https://github.com/smartcontractkit/ccip-icm, Foundry, unaudited): Sepolia `MessageSender`
  →(CCIP)→ Fuji `MessageBroker` →(ICM)→ L1 `MessageReceiver`. CCIP does not reach custom L1s directly; the Fuji
  broker bridges that gap (verify).

### x402 on Avalanche

- Academy: https://build.avax.network/academy/blockchain/x402-payment-infrastructure
- Facilitator: self-hosted official `@x402/core` + `@x402/evm` (2.29.0); it supports Permit2 and custom chains.
  Hosted options (PayAI, Ultravioleta DAO, thirdweb) lack confirmed Permit2 support for arbitrary tokens on 43114.
- Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3` and x402 proxy `0x402085c248EeA27D92E8b30b2C58ed07f9E20001`
  are hardcoded in `@x402/evm`; on a new L1 deploy them via the Arachnid deployer (see `docs/decisions.md` Q15).
- Fuji (chain ID 43113) USDC: `0x5425890298aed601595a70AB815c96711a31Bc65` (ERC-3009).
- Reference: https://github.com/federiconardelli7/x402-starter-kit (x402 on Fuji, thirdweb facilitator).

### ERC-8004 (official, github.com/erc-8004/erc-8004-contracts)

| Registry | Avalanche C-Chain (43114) | Fuji (43113) |
|---|---|---|
| Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Register with `register(string agentURI)`; the Validation registry is not finalized.

## Output Contract

- Cite the source (MCP tool or URL) for every Avalanche fact used.
- Flag each address, chain ID, and command as verified or unverified.

## References

- `docs/decisions.md`: project decisions and verified facts, including Twin token addresses.
