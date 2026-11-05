# Agent instructions

## Ethereum

Read https://ethskills.com/SKILL.md and follow it before writing Solidity or shipping anything onchain.

## Avalanche

- MCP (read-only, project-scoped in `.mcp.json`): `https://build.avax.network/api/mcp`
- Docs for LLMs: https://build.avax.network/llms.txt (pages as `https://build.avax.network/{path}.md`;
  https://build.avax.network/llms-full.txt only when full context is needed)
- Local skill: `.claude/skills/avalanche/SKILL.md`. Load it for any Avalanche, Fuji, L1, ICM/ICTT, x402, or
  ERC-8004 work.

## OpenZeppelin

- MCP (project-scoped in `.mcp.json`): `https://mcp.openzeppelin.com/contracts/solidity/mcp`. Use it to scaffold
  OZ 5.7 contract bases. It has no ERC-3009 option.

## Chainlink

- `.claude/skills/chainlink-ccip-skill/SKILL.md`: load it for CCIP senders, receivers, and `CCIPLocalSimulator`
  tests.
- `.claude/skills/chainlink-data-feeds-skill/SKILL.md`: load it for `latestRoundData` price feed reads.
- Both are vendored as-is from `smartcontractkit/chainlink-agent-skills` (MIT). Do not run `npx` or any script from
  them. Project rules win over their defaults: keystores only (no `--private-key`), pnpm only (no `forge install`),
  no mocks in demos.

## Project

- Decisions and verified addresses: [`docs/decisions.md`](docs/decisions.md). Read it before planning or coding.
- Smart contract standards: [`docs/standards/smart-contracts.md`](docs/standards/smart-contracts.md).
- Planning prompt: [`docs/plan-prompt.md`](docs/plan-prompt.md)
- Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) (issue → branch → commits → PR → merge; Conventional Commits; English;
  no AI attribution; code comments are one line or none).
