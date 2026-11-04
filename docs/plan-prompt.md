---
title: Planning prompt
sidebar_position: 1
---

# Planning prompt — Hackatwin: Autonomous Payments on Avalanche L1

> Paste this into a fresh agent session (plan mode). The agent must produce `docs/PLAN.md`. Do not write code yet.

## Role

You are a senior Web3 + AI architect. Produce an implementation plan for a demo repository used in a live
hackathon talk. You plan; you do not implement. The design decisions are already made in
[`docs/decisions.md`](decisions.md): plan within them. Reopen one only when a verified fact contradicts it, and say
so. Verify every on-chain fact (addresses, chain IDs, package names) with the MCP servers or official docs before
writing it into the plan, and mark anything unverified.

## Step 0 — Load tooling before planning (mandatory)

1. Confirm the `avalanche-mcp` server (from `.mcp.json`) is connected. If not:
   `claude mcp add avalanche-mcp --transport http https://build.avax.network/api/mcp`
2. Confirm the `OpenZeppelinSolidityContracts` server (from `.mcp.json`) is connected. If not:
   `claude mcp add OpenZeppelinSolidityContracts --transport http https://mcp.openzeppelin.com/contracts/solidity/mcp`
3. Confirm the ethskills plugin is enabled (from `.claude/settings.json`). If not:
   `/plugin marketplace add austintgriffith/ethskills` then `/plugin install ethskills@ethskills`.
   Load `ship` first, then `standards`, `wallets`, `security`, `testing`, `addresses`, `frontend-ux`, `orchestration`.
4. Load the local skills: `.claude/skills/avalanche/SKILL.md`, `.claude/skills/chainlink-ccip-skill/SKILL.md`, and
   `.claude/skills/chainlink-data-feeds-skill/SKILL.md`.
5. Read [`docs/decisions.md`](decisions.md), [`docs/standards/smart-contracts.md`](standards/smart-contracts.md),
   [`docs/demos.md`](demos.md), and [`docs/references/twin-finance-contracts.md`](references/twin-finance-contracts.md).
6. Read https://build.avax.network/docs/tooling/ai-llm.md and skim https://build.avax.network/llms.txt for the
   sections you need (L1s, ICM, ICTT, x402 academy). Pull pages as `/{path}.md`.
7. Read the reference repos:
   - https://github.com/federiconardelli7/x402-starter-kit (Demo 1 client flow only)
   - https://github.com/coinbase/x402 (facilitator packages, Permit2 proxy deploy script)
   - https://github.com/smartcontractkit/ccip-icm (Demo 2 flow only, not its code standards)
   - https://github.com/ava-labs/icm-services (ICTT interfaces)
   - https://github.com/defi-wonderland/solidity-foundry-boilerplate (`dev` branch, contracts template)
   - https://github.com/trailofbits/claude-code-devcontainer (devcontainer base)
8. Re-check the facts in `docs/decisions.md` that can drift (package versions, CCIP lane status, ARGt roles on
   C-Chain) and report any change.
9. Report what loaded, what failed, and what was verified before writing any plan section.

## Event context

- Event: **Hackatwin** (Twin Finance hackathon). Tracks: 🤖 AI (agents, automation), ⛓️ Blockchain (onchain apps,
  infra, builder tools), 💸 Fintech (payments, remittances, moving money in LATAM).
- Talk: **"Pagos Autónomos en Avalanche L1: x402, Stablecoins y Agentes de IA"**, co-presented by Twin × team1.
- Premise: everything is **agent-driven development**. The repo itself must be built by agents using MCP + skills,
  and the talk shows that workflow.
- Talk narrative (the frontend must follow this order):
  1. Short Avalanche primer: Primary Network (C-Chain, P-Chain, X-Chain), L1s (Avalanche9000 / ACP-77).
  2. First on-chain transaction on Fuji C-Chain (wallet → tx → explorer).
  3. AI agents on Avalanche with an on-chain identity (**ERC-8004**).
  4. **Demo 1** — agentic payments with x402 + stablecoins (Twin).
  5. **Demo 2** — a dedicated Avalanche L1 for agentic payments, cross-chain via Chainlink CCIP + Avalanche ICM.
  6. **Demo 3** — Demos 1 and 2 composed: an x402 agentic payment on the L1.
- LayerZero is a talk topic only: how real ARGt moves across chains in production (Q18).

Runbooks for all three demos: [`docs/demos.md`](demos.md).

## Demo 1 — Agentic payments with x402 + Twin (live)

Goal: an AI agent with an ERC-8004 identity pays for an API resource autonomously using x402 (HTTP 402), in the
real ARGt token. No custom contract (Q4).

- **Chain**: a local anvil fork of Avalanche C-Chain mainnet with the real ARGt contract (Q17). The agent gets ARGt
  by calling the real `mint(address,uint256)` while impersonating Twin's LayerZero adapter. The agent key is fresh
  and never funded on mainnet (Q20).
- **Seller API**: an x402-protected endpoint (for example an FX quote or LATAM payment-rail data), priced in USD and
  paid in ARGt with the x402 `exact` scheme and `assetTransferMethod: "permit2"` (ARGt has no permit and no ERC-3009).
- **Facilitator**: the self-hosted official x402 TypeScript facilitator behind the `PaymentGateway` port (Q11).
  PayAI is an optional alternative adapter; x402-rs is the fallback.
- **Pricing**: the `PriceOracle` port with `GuardedOracle` over `CurvePoolOracle` and `ChainlinkFeedOracle`, and a
  `pnpm quote` script that reuses the same adapters (Q12/Q16). The UI shows the source of the rate and that it is an
  executable market rate, not an official one.
- **Buyer agent**: LLM agent (default Claude `claude-sonnet-5-5`, behind the `LLM` port) with an EOA wallet, an x402
  client, an ERC-8004 identity on the fork, and an off-chain budget (`AgentPolicy`, Q5). It decides to buy, pays,
  uses the result, and posts feedback to the ERC-8004 Reputation Registry.
- **Reference implementation**: https://github.com/federiconardelli7/x402-starter-kit runs x402 on Fuji with the
  thirdweb facilitator. Reuse its proven client flow, restructured into our hexagonal packages. Do not copy its
  monolithic layout or its facilitator choice.

## Demo 2 — Avalanche L1 for cross-chain agentic payments (live + recorded fallback)

Goal: show the infra side: P-Chain, a custom L1, and cross-chain settlement (Q7).

- **L1**: create a Fuji L1 ("TwinPay L1") with `platform-cli` and the Builder Hub docs. Cover the P-Chain steps
  (subnet creation, conversion to L1, validators). Genesis per Q15.
- **Infra**: one validator node and one ICM relayer, self-hosted with `docker-compose` in `infra/` (Q19).
- **Cross-chain**: Sepolia →(CCIP, data-only)→ Fuji `PaymentBroker` → `PaymentHub` →(ICTT `sendAndCall`, USDC +
  instruction)→ L1 `SettlementReceiver` (Q14). Keep the ccip-icm flow, fix its gaps
  ([standards § 5](standards/smart-contracts.md#5-lessons-from-ccip-icm)).
- **Payment agent**: reuses the Demo 1 agent core, triggers the payment, and tracks it end to end (CCIP Explorer →
  Fuji → L1 explorer).
- ccip-icm is unaudited. Keep everything on testnets.

## Demo 3 — Integration: x402 agentic commerce on the L1 (live + recorded fallback)

Goal: prove the architecture composes. Demo 3 owns **no domain logic**. It is a composition root that consumes
Demo 1 and Demo 2 as modules and wires them through config (Q13).

- Each of Demos 1 and 2 exports a **module**: a function that registers its ports → adapters into the DI container
  (e.g. `registerX402Module(container, config)`, `registerCrossChainModule(container, config)`). Demos 1 and 2 run
  standalone through their own composition roots and are also importable as workspace dependencies.
- `demos/03-.../demo3.config.ts` (typed and validated, e.g. with zod) selects modules and adapters, for example:
  `network: 'twinpay-l1' | 'fuji-cchain'`, `asset: 'USDC' | 'ARGt'`, `transferMethod: 'permit2' | 'eip3009'`,
  `facilitator: 'x402-ts' | 'payai' | 'x402-rs'`, `llm: 'claude' | 'openrouter'`. Changing config changes behavior
  with no code change. That is the demo moment.
- Reference flow: Demo 2 funds the agent on the L1 via ICTT → the agent finds a paid API on the L1 → HTTP 402 with
  the USD price shown in ARGt → the agent pays USDC via x402 Permit2 (Permit2 and the x402 proxy at their canonical
  addresses on the L1) → the self-hosted facilitator settles on the L1 → the agent's ERC-8004 reputation is updated
  on Fuji.
- Fallback profile: Fuji C-Chain + Circle USDC (ERC-3009). Same code, different profile.

## Frontend

One frontend for all three demos (landing + guided talk path + `/demo-1` + `/demo-2` + `/demo-3`). `/demo-3`
shows the active config and lets the presenter switch profiles live.

- Visual references: https://www.twin.finance/es (institutional layout: hero, manifesto, split cards, tagline band,
  FAQ; dark base with orange accent) and the **HACKATWIN** key visual: black background, cream monospace text,
  orange accent lines, circuit-style connectors, `> HACKATWIN_` with a blinking cursor, `connect(tradition, protocol);`,
  `[ 01 10 11 ]`, `block_001 / verified`.
- Co-branding: **Twin × team1**. Use the team1 logo (`https://www.team1.network/team1.svg`) and aesthetic
  (https://www.team1.network/), plus a "Built on Avalanche" link to https://build.avax.network/. Check logo usage rights.
- Live state in the UI: wallet connect, the agent's reasoning and tool calls, the 402 → pay → 200 flow, tx hashes
  (linked to explorers on public networks), and cross-chain message status.
- Demos 2 and 3 need a recorded fallback (pre-run tx hashes or a replay) in case the network fails on stage.
  Demo 1 is live-only on a local fork (Q2).

## Engineering principles (non-negotiable)

- **KISS, DRY, YAGNI. Less is more.** Prefer deleting over adding; no abstraction without a second use.
- Lean, modular, clear separation of concerns. Hexagonal: domain (payment intent, pricing, agent policy) →
  ports (`PaymentGateway`, `AgentIdentity`, `AgentPolicy`, `ChainClient`, `LLM`, `CrossChainMessenger`,
  `PriceOracle`) → adapters (x402 client and facilitator, viem, ERC-8004 registries, CCIP/ICTT, Anthropic SDK,
  Curve/Chainlink).
- Shared code lives in packages; demos only compose it. No logic duplicated between demos.
- TypeScript strict, viem/wagmi, pnpm workspaces. Justify any extra tool.
- Container/presentational split and atomic design in the frontend.
- **No mainnet transactions** (testnets plus a local mainnet fork; mainnet reads off-chain only) and **no mocks** in
  the demos (C1). No secrets in the repo (`.env.example` only).

## Documentation — Docusaurus

- Content lives in `docs/` as plain Markdown with Docusaurus frontmatter, readable on GitHub as is. The site is
  `apps/docs` (Docusaurus, classic preset, `docs.path: '../../docs'`). One source, no copies.
- Diagrams: `docs/diagrams/*.excalidraw` are the sources. Each has an exported `.svg` with the embedded scene, so
  the image stays editable.
- English only. Short pages: one concept per page, with a diagram first and text second.

## Dependency injection (repo-wide, not only in demos)

- Every runnable unit has exactly one **composition root** that builds the container from typed, validated config:
  seller API, facilitator, each agent, each demo, Next.js server code, scripts, and E2E suites. Business code never
  calls `new` on an adapter and never reads `process.env`. Only the composition root does.
- Constructor or factory injection against port interfaces defined in `packages/core`. Default to a small typed
  container in `packages/core` (tokens + factories + scopes) with no decorators or `reflect-metadata`. Adopt a
  library (awilix, tsyringe, inversify) only with a written tradeoff.
- Frontend: adapters are provided at the app root via React context providers. Hooks and containers consume ports;
  presentational components receive only props.
- Solidity: inject dependencies through constructor parameters and interfaces (CCIP router, ICTT transferrer,
  token, registries). No hardcoded addresses. Deploy scripts read them from the shared chain registry config.
- Tests swap adapters through the same container (fakes in unit tests, local simulators in E2E). That is the payoff
  of DI and should be visible in the talk.

## Smart contracts — Foundry only

Follow [`docs/standards/smart-contracts.md`](standards/smart-contracts.md): design (Morpho Blue patterns), the state
pattern, Wonderland code standards, pinned dependencies, and the ccip-icm lessons. For the plan:

- One Foundry project for `PaymentHub`, `IcttMessenger`, `PaymentBroker`, and `SettlementReceiver`, plus deploy
  scripts for Permit2 and the x402 proxy on the L1.
- Keep git hooks, commitlint, and CI at the repo root once. Drop the template's per-project `.husky/`,
  `commitlint.config.js`, and `.github/`.
- `forge`, `cast`, `anvil`, `forge-std`. No Hardhat. Chainlink Local's simulator for CCIP tests.
- Run ethskills `security` and `audit` checklists before any Fuji or L1 deploy.

## Testing strategy — TypeScript E2E

- Unit and integration (TS): Vitest, with ports faked through DI.
- **E2E (TS)** in a root `e2e/` workspace:
  - Protocol E2E: Vitest + viem against `anvil` (the C-Chain fork for Demo 1, a Fuji fork for the contracts) and
    local simulators. It covers the full 402 → pay → 200 flow, the cross-chain settlement flow, and the Demo 3
    config matrix (each profile is a test case).
  - UI E2E: Playwright against the frontend, with a test wallet.
  - Testnet smoke tests: real Fuji, Sepolia, and L1, run manually or nightly, never required in PR CI.
- The E2E suites build their own container via a test composition root. There are no special code paths for tests.

## Git and GitHub workflow (non-negotiable)

`CONTRIBUTING.md`, the issue forms, and the PR template already exist. They are the source of truth; follow them.
Summary:

- **Flow: issue → branch → commits → PR → merge.** Every task in the plan maps to exactly one issue.
- **Issues are tiny**: the `Task` form (What, Done when) or the `Bug` form (What happened, Expected). Less is more.
- **Gitflow**: `main` (production, tagged releases), `develop` (integration), `feature/<name>` (kebab-case, from
  `develop`), `release/x.y.z` (from `develop`), and `hotfix/<name>` (from `main`). Release and hotfix branches merge
  into `main` and back into `develop`. No direct pushes to `main` or `develop`.
- **Conventional Commits v1.0.0** (https://www.conventionalcommits.org/en/v1.0.0/): `<type>(<scope>)[!]: <description>`.
  `feat` → MINOR, `fix` → PATCH, and `!` or a `BREAKING CHANGE:` footer → MAJOR. Scope = module; the footer is
  `Refs #<issue>`. Enforce with commitlint + a commit-msg hook; generate the changelog and SemVer tags from commits.
- **PRs**: English, one issue each, small; the body uses the template with `Closes #<issue>`; squash into `develop`.
- **English everywhere**: code, comments, identifiers, docs, commits, issues, PRs.
- **No AI attribution anywhere**: no `Co-Authored-By`, no "Generated with ..." footers, no AI credits in code or docs.
- **Branch protection** (rulesets) on `main` and `develop`: PR required, required checks green, no force push, no deletion.

## CI/CD (best practices, non-negotiable)

`.github/workflows/ci.yml` already checks PR titles, commit messages, branch names (gitflow), and workflow files.
Extend it; do not create a parallel pipeline.

- **CI per workspace** as code lands: lint, typecheck, Vitest, `forge fmt --check` + `forge build` + `forge test`,
  lintspec, protocol E2E against anvil, Playwright E2E, builds. Use path filters so each demo runs only its own
  jobs; Demo 3 also runs when Demo 1, Demo 2, or the shared packages change. Fast checks gate every PR; slow suites
  (testnet smoke, deep fuzz) run nightly or on demand.
- **Hygiene**: least-privilege `permissions` per workflow, actions pinned to commit SHAs (Dependabot keeps them
  updated), `concurrency` with cancel-in-progress, `timeout-minutes` on every job, pnpm and Foundry caches, and
  reproducible installs (`--frozen-lockfile`).
- **Secrets**: only in GitHub Environments, never in the repo. Use OIDC instead of long-lived cloud tokens where
  supported. Deployer keys are encrypted keystores, scoped to an environment.
- **CD by branch**:
  - PR → preview deploys (frontend and docs).
  - `develop` → staging (web + docs) automatically. Contract deploys to Fuji or the L1 run only via
    `workflow_dispatch` on a `testnet` environment with a required reviewer; verify on the explorer and record the
    addresses in `packages/chains`.
  - `main` → production (the talk build). Merging `release/x.y.z` tags `vX.Y.Z` and publishes a GitHub Release with
    a changelog generated from Conventional Commits. Docusaurus deploys to GitHub Pages.
  - Rollback = redeploy the previous tag. Deploys are idempotent and never depend on a developer's machine.

## Proposed structure (validate or improve; justify changes)

```
hackatwin-x402-team1-avalanche/
├── docs/                       # Markdown content (decisions, demos, standards, references, diagrams, PLAN.md)
├── apps/web/                   # single frontend: landing, guided path, /demo-1, /demo-2, /demo-3
├── apps/docs/                  # Docusaurus site; docs.path → ../../docs (content stays in docs/)
├── demos/
│   ├── 01-x402-twin/
│   │   ├── seller-api/         # x402-protected API (own composition root)
│   │   ├── facilitator/        # self-hosted x402 facilitator (own composition root)
│   │   ├── buyer-agent/        # agent: ERC-8004 identity + x402 client (own composition root)
│   │   ├── scripts/            # fork start, funding (impersonated mint), identity registration
│   │   └── module.ts           # registerX402Module(container, config): public entry for Demo 3
│   ├── 02-l1-crosschain/
│   │   ├── l1/                 # platform-cli scripts, genesis, L1 config
│   │   ├── payment-agent/      # cross-chain payment agent (own composition root)
│   │   └── module.ts           # registerCrossChainModule(container, config)
│   └── 03-agentic-crosschain-commerce/
│       ├── demo3.config.ts     # typed config: selects modules + adapters
│       └── main.ts             # composition root only, no domain logic
├── packages/
│   ├── core/                   # DI container, domain types, port interfaces, config schemas
│   ├── chains/                 # chain registry: C-Chain fork, Fuji, Sepolia, TwinPay L1, Arbitrum + Base (read-only)
│   ├── contracts/              # Foundry (Wonderland conventions): PaymentHub, IcttMessenger, PaymentBroker, SettlementReceiver
│   ├── pricing/                # PriceOracle adapters: CurvePoolOracle, ChainlinkFeedOracle, GuardedOracle
│   ├── agent-kit/              # agent adapters (wallet, ERC-8004, x402 client, LLM) implementing core ports
│   └── ui/                     # design tokens + components (Twin × team1 × HACKATWIN)
├── infra/                      # docker-compose: L1 validator node + ICM relayer
├── e2e/                        # TS E2E: protocol (Vitest + viem + anvil), UI (Playwright), testnet smoke
├── .devcontainer/              # Trail of Bits upstream + Foundry/pnpm/bulloak/lintspec + firewall allowlist
├── .github/                    # workflows (CI), PR + issue templates, CODEOWNERS
├── .mcp.json                   # Avalanche MCP + OpenZeppelin MCP (project scope)
├── .claude/                    # settings.json (ethskills plugin), skills/ (avalanche, chainlink-ccip, chainlink-data-feeds)
├── AGENTS.md                   # same tooling pointers for non-Claude agents
├── CONTRIBUTING.md             # gitflow + commit conventions
└── .env.example
```

## Agent tooling already wired in the repo (showcase it in the talk)

- `.mcp.json` → Avalanche MCP (read-only): https://build.avax.network/api/mcp. Tools: `docs_search`, `docs_fetch`,
  `cli_lookup_command`, `rpc_lookup_method`, `platform_get_*`, `info_*`, `blockchain_*`, `github_*`.
- `.mcp.json` → OpenZeppelin MCP: https://mcp.openzeppelin.com/contracts/solidity/mcp (8 generators, targets OZ
  ^5.7.0, no ERC-3009 option).
- `.claude/settings.json` → ethskills plugin. `.claude/skills/avalanche/` → local Avalanche skill
  (no official Avalanche skill package exists). `.claude/skills/chainlink-ccip-skill/` and
  `.claude/skills/chainlink-data-feeds-skill/` → vendored from `smartcontractkit/chainlink-agent-skills`.
  `AGENTS.md` → the same pointers for other agents.
- Avalanche docs for LLMs: https://build.avax.network/docs/tooling/ai-llm, https://build.avax.network/llms.txt,
  https://build.avax.network/llms-full.txt
- ICM / ICTT: https://build.avax.network/docs/cross-chain/icm-contracts/deep-dive.md,
  https://build.avax.network/console/icm/setup, https://build.avax.network/console/ictt/setup
- Platform CLI: `curl -sSfL https://build.avax.network/install/platform-cli | sh` then `platform-cli --help`
  (releases: https://github.com/ava-labs/platform-cli/releases)
- ethskills (https://ethskills.com/): `/plugin marketplace add austintgriffith/ethskills` and
  `/plugin install ethskills@ethskills`. Use `standards` (x402, ERC-8004, EIP-3009), `wallets`, `security`,
  `testing`, `addresses`, `frontend-ux`, `orchestration`.
- x402 on Avalanche (academy): https://build.avax.network/academy/blockchain/x402-payment-infrastructure

## Known facts

The full list, with sources, is in [`docs/decisions.md` › Verified facts](decisions.md#verified-facts). The ones the
plan depends on most:

| Item | Value | Status |
|---|---|---|
| Chain IDs | C-Chain 43114, Fuji 43113, Arbitrum 42161 | official |
| ARGt on Avalanche C-Chain | `0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B` (not in Twin's registry; no permit, no ERC-3009) | verified |
| ARGt on testnets | none | verified |
| Fuji USDC (Circle) | `0x5425890298aed601595a70AB815c96711a31Bc65` | verified |
| ERC-8004 (Fuji) | Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e`, Reputation `0x8004B663056A597Dffe9eCcC1965A193B7388713` | verified (official repo) |
| x402 facilitator | `@x402/core@2.29.0` + `@x402/evm@2.29.0`, self-hosted; Permit2 + x402 proxy on C-Chain and Fuji | verified |
| CCIP Sepolia → Fuji | selectors `16015286601757825753` → `14767482510784806043`; `@chainlink/contracts-ccip@2.0.0` | verified |
| ARGt pricing | Curve ARGt/USD₮0 (Arbitrum) guarded by Chainlink ARS/USD (Base) | verified |
| OpenZeppelin | `@openzeppelin/contracts@5.7.0` | verified |
| ICM / ICTT | `ava-labs/icm-services`; Teleporter `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` | verified |
| ccip-icm networks | Sepolia → Fuji (43113) → Dispatch L1 (779672) | repo README (reference only) |

## Required output: `docs/PLAN.md`

1. Architecture overview starting from `docs/diagrams/overview.excalidraw` (keep its style: orthogonal arrows, no
   arrow crossing a box), plus one flow per demo (reuse `docs/diagrams/demo-1.excalidraw` and
   `docs/diagrams/demo-2-3.excalidraw`) and a DI diagram showing each composition root and the ports and adapters it
   wires (start from `docs/diagrams/modules.excalidraw`).
2. Final repo structure with each module's responsibility in one line.
3. Phased milestones (repo setup: CI, commitlint, Docusaurus at `apps/docs` → devcontainer (Trail of Bits upstream +
   Foundry/pnpm/bulloak/lintspec + firewall allowlist) → scaffold + `packages/core` DI → shared packages (chains,
   pricing + `pnpm quote`) → Demo 1 → infra + TwinPay L1 → contracts → Demo 2 → Demo 3 → frontend → E2E hardening →
   rehearsal with recorded fallbacks → `release/1.0.0`), each with acceptance criteria, a demoable result, and the
   tests that prove it.
4. Task breakdown per phase, small enough for one agent session each, with dependencies. Write each task as a
   ready-to-file `Task` issue: a title (conventional style), What (1–2 lines), and Done when (checkboxes). Add its
   branch name. Nothing more.
5. Decisions with tradeoffs, only for what `docs/decisions.md` leaves open: the DI container (hand-rolled vs
   library), its open points, how E2E exercises ICTT paths locally, and a one-paragraph confirmation of the hybrid
   against [`docs/architecture-alternative.md`](architecture-alternative.md).
6. Risks + mitigations (facilitator Permit2 support, testnet faucets, CCIP lane availability, L1 validator expiry,
   public RPC for the fork, the thin Curve pool, live-demo failure).
7. Talk run-of-show: minute-by-minute script mapped to frontend screens and fallbacks.
8. Open questions for the humans, one per line. Do not guess answers.
