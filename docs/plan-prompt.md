---
title: Planning prompt
sidebar_position: 1
---

# Planning prompt — Hackatwin: Autonomous Payments on Avalanche L1

> Paste this into a fresh agent session (plan mode). The agent must produce `docs/PLAN.md`. Do not write code yet.

## Role

You are a senior Web3 + AI architect. Produce an implementation plan for a demo repository used in a live
hackathon talk. You plan; you do not implement. Verify every on-chain fact (addresses, chain IDs, package names)
with the Avalanche MCP or official docs before writing it into the plan, and mark anything unverified.

## Step 0 — Load tooling before planning (mandatory)

1. Confirm the `avalanche-mcp` server (from `.mcp.json`) is connected. If not:
   `claude mcp add avalanche-mcp --transport http https://build.avax.network/api/mcp`
2. Confirm the ethskills plugin is enabled (from `.claude/settings.json`). If not:
   `/plugin marketplace add austintgriffith/ethskills` then `/plugin install ethskills@ethskills`.
   Load `ship` first, then `standards`, `wallets`, `security`, `testing`, `addresses`, `frontend-ux`, `orchestration`.
3. Load the local skill `.claude/skills/avalanche/SKILL.md`.
4. Read https://build.avax.network/docs/tooling/ai-llm.md and skim https://build.avax.network/llms.txt for the
   sections you need (L1s, ICM, ICTT, x402 academy). Pull pages as `/{path}.md`.
5. Read the reference repos: https://github.com/federiconardelli7/x402-starter-kit (Demo 1) and
   https://github.com/smartcontractkit/ccip-icm (Demo 2).
6. Read `docs/references/twin-finance-contracts.md`. Verify its addresses on Arbiscan, and find Twin's official
   registry, especially any **Avalanche** deployments of ARGt and the other stables (does the token support
   ERC-3009 or ERC-2612?). Record the verified/unverified status for each row.
7. Report what loaded, what failed, and what was verified before writing any plan section.

## Event context

- Event: **Hackatwin** (Twin Finance hackathon). Tracks: 🤖 AI (agents, automation), ⛓️ Blockchain (onchain apps,
  infra, builder tools), 💸 Fintech (payments, remittances, moving money in LATAM).
- Talk: **"Pagos Autónomos en Avalanche L1: x402, Stablecoins y Agentes de IA"**, co-presented by Twin × team1.
- Premise: everything is **agent-driven development**. The repo itself must be built by agents using MCP + skills,
  and the talk shows that workflow.
- Talk narrative (the frontend must follow this order):
  1. Short Avalanche primer: Primary Network (C-Chain, P-Chain, X-Chain), L1s (Avalanche9000 / ACP-77).
  2. First on-chain transaction on Fuji C-Chain (wallet → tx → explorer).
  3. AI agents on Avalanche with an on-chain identity (**ERC-8004**; propose an alternative only with a reason).
  4. **Demo 1** — agentic payments with x402 + stablecoins (Twin).
  5. **Demo 2** — a dedicated Avalanche L1 for agentic payments, cross-chain via Chainlink CCIP + Avalanche ICM.
  6. **Demo 3** — Demos 1 and 2 composed: an x402 agentic payment that settles cross-chain on the L1.

## Demo 1 — Agentic payments with x402 + Twin

Goal: an AI agent with an ERC-8004 identity pays for an API resource autonomously using x402 (HTTP 402).

- **Seller API**: an x402-protected endpoint (e.g. an FX quote or LATAM payment-rail data). Prices are quoted in
  **ARGt (mock)** and settled in **USDC on Fuji**.
- **Buyer agent**: LLM agent (default Claude `claude-sonnet-5-5`, behind a port so it is swappable) with a wallet,
  an x402 client, and an ERC-8004 identity. It decides to buy, pays, and uses the result. After the call it posts
  feedback to the ERC-8004 Reputation Registry.
- **Mock ARGt**: ERC-20 + ERC-3009 on Fuji, named and labeled as a mock everywhere (UI, README, token name), and
  mirroring the real ARGt interface. The real Twin tokens are mainnet (Arbitrum; Avalanche per the registry,
  pending verification) and the demo never moves real funds. Stretch goal: also accept mock ARGt through a
  self-hosted facilitator (x402-rs), since public facilitators may only support USDC.
- **Live FX from real Twin contracts (read-only)**: the ARGt quote uses a `PriceOracle` port with these adapters:
  `CurvePoolOracle` (ARGt/USD₮0 pool on Arbitrum, see `docs/references/twin-finance-contracts.md`),
  `DiaOracle`, and `FixedRateOracle` (offline fallback and tests). Config selects the adapter. The UI shows the
  source of the rate and that it is an executable market rate, not an official one.
- **Stretch — treasury view (read-only)**: a `YieldVenue` port with a `MorphoVaultAdapter` that reads the DAMM-curated
  Morpho vaults. Gate it behind config and an explicit go-ahead from Twin, since Twin markets its stables as
  non-yield payment instruments.
- **Reference implementation**: https://github.com/federiconardelli7/x402-starter-kit, which runs x402 on Fuji with
  the thirdweb facilitator (Next.js 16, thirdweb SDK v5, shadcn). It has a human mode, token-metered AI chat, and an
  autonomous agent with a pre-authorized budget. Reuse its proven flow but restructure it into our hexagonal
  packages. Do not copy its monolithic layout.
- Facilitator: default to **thirdweb** (proven by the starter kit; needs an ERC-4337 server wallet, ERC-7702 unsupported).
  Alternatives: Ultravioleta DAO, PayAI, 0xGasless, or self-hosted x402-rs. Keep it behind the `PaymentGateway` port.

## Demo 2 — Avalanche L1 for cross-chain agentic payments

Goal: show the infra side, P-Chain + a custom L1 + cross-chain settlement.

- **L1**: create a Fuji L1 (working name "TwinPay L1") with `platform-cli` and the Builder Hub docs. Cover P-Chain
  steps (subnet creation, conversion to L1, validators). Evaluate genesis options relevant to payments: a stablecoin-like
  native gas token, low fee config, and Transaction/Contract AllowList precompiles (only registered agents can transact).
- **Cross-chain**: base it on https://github.com/smartcontractkit/ccip-icm. Its pattern is
  Sepolia `MessageSender` →(CCIP)→ Fuji `MessageBroker` →(ICM)→ L1 `MessageReceiver`. Adapt it so the message is a
  **payment instruction** that settles on the L1. Evaluate Interchain Token Transfer (ICTT) for moving USDC from
  C-Chain into the L1. CCIP does not reach custom L1s directly; the Fuji broker bridges that gap. Verify this.
- **Payment agent**: an agent (reusing the Demo 1 agent core) triggers the cross-chain payment and tracks it
  end to end (CCIP explorer → ICM → L1 explorer).
- ccip-icm is unaudited. Keep everything on testnets.

## Demo 3 — Integration: x402 agentic commerce with cross-chain L1 settlement

Goal: prove the architecture composes. Demo 3 owns **no domain logic**. It is a composition root that consumes
Demo 1 and Demo 2 as modules and wires them through config.

- Each of Demos 1 and 2 exports a **module**: a function that registers its ports → adapters into the DI container
  (e.g. `registerX402Module(container, config)`, `registerCrossChainModule(container, config)`). Demos 1 and 2 run
  standalone through their own composition roots and are also importable as workspace dependencies.
- `demos/03-.../demo3.config.ts` (typed and validated, e.g. with zod) selects modules and adapters, for example:
  `settlement: "fuji" | "twinpay-l1"`, `facilitator: "thirdweb" | "x402-rs"`, `quoteCurrency: "ARGt-mock"`,
  `llm: "claude" | "openrouter"`. Changing config changes behavior with no code change. That is the demo moment.
- Reference flow (the planner may improve it): the agent finds a paid API → gets HTTP 402 with a price in mock ARGt →
  pays USDC on Fuji via x402 → the seller emits a settlement instruction → Fuji broker forwards it via ICM (or
  CCIP→ICM from Sepolia) → TwinPay L1 credits the merchant → the agent's ERC-8004 reputation is updated.
- Evaluate the alternative of settling x402 directly on TwinPay L1 through a self-hosted facilitator (x402-rs),
  since public facilitators will not support a custom L1. Expose it as a config switch, not a fork of the code.

## Frontend

One frontend for all three demos (landing + guided talk path + `/demo-1` + `/demo-2` + `/demo-3`). `/demo-3`
shows the active config and lets the presenter toggle adapters live.

- Visual references: https://www.twin.finance/es (institutional layout: hero, manifesto, split cards, tagline band,
  FAQ; dark base with orange accent) and the **HACKATWIN** key visual: black background, cream monospace text,
  orange accent lines, circuit-style connectors, `> HACKATWIN_` with a blinking cursor, `connect(tradition, protocol);`,
  `[ 01 10 11 ]`, `block_001 / verified`.
- Co-branding: **Twin × team1**. Use the team1 logo (`https://www.team1.network/team1.svg`) and aesthetic
  (https://www.team1.network/), plus a "Built on Avalanche" link to https://build.avax.network/. Check logo usage rights.
- Live state in the UI: wallet connect, the agent's reasoning and tool calls, the 402 → pay → 200 flow, tx hashes
  linked to explorers, and cross-chain message status.
- Every live step needs a recorded fallback (pre-run tx hashes or a replay) in case the network fails on stage.

## Engineering principles (non-negotiable)

- **KISS · DRY · YAGNI. Less is more.** Prefer deleting over adding; no abstraction without a second use.
- Lean, modular, clear separation of concerns. Hexagonal: domain (payment intent, pricing, agent policy) →
  ports (`PaymentGateway`, `AgentIdentity`, `ChainClient`, `LLM`, `CrossChainMessenger`, `PriceOracle`,
  `YieldVenue`) → adapters (x402 facilitator, viem, ERC-8004 registries, CCIP/ICM, Anthropic SDK, Curve/DIA, Morpho).
- Shared code lives in packages; demos only compose it. No logic duplicated between demos.
- TypeScript strict, viem/wagmi, pnpm workspaces. Justify any extra tool.
- Container/presentational split and atomic design in the frontend.
- Testnets only. No secrets in the repo (`.env.example` only).

## Documentation — Docusaurus

- Content lives in `docs/` as plain Markdown with Docusaurus frontmatter, readable on GitHub as is. The site is
  `apps/docs` (Docusaurus, classic preset, `docs.path: '../../docs'`). One source, no copies.
- Diagrams: the `.excalidraw` file is the source. For the site, export an SVG with the embedded scene, so the
  image stays editable.
- English only. Short pages: one concept per page, with a diagram first and text second.

## Dependency injection (repo-wide, not only in demos)

- Every runnable unit has exactly one **composition root** that builds the container from typed, validated config:
  seller API, each agent, each demo, Next.js server code, scripts, and E2E suites. Business code never calls
  `new` on an adapter and never reads `process.env`. Only the composition root does.
- Constructor or factory injection against port interfaces defined in `packages/core`. Default to a small typed
  container in `packages/core` (tokens + factories + scopes) with no decorators or `reflect-metadata`. Adopt a
  library (awilix, tsyringe, inversify) only with a written tradeoff.
- Frontend: adapters are provided at the app root via React context providers. Hooks and containers consume ports;
  presentational components receive only props.
- Solidity: inject dependencies through constructor parameters and interfaces (CCIP router, ICM messenger, token,
  registries). No hardcoded addresses. Deploy scripts read them from the shared chain registry config.
- Tests swap adapters through the same container (fakes in unit tests, local simulators in E2E). That is the payoff
  of DI and should be visible in the talk.

## Smart contracts — Foundry only

- `forge`, `cast`, `anvil`, `forge-std`. No Hardhat. One Foundry project per demo `contracts/`, sharing remappings
  and libraries.
- Tests: unit, fuzz, and invariant tests (payment accounting), plus fork tests against Fuji. Use Chainlink Local's
  CCIP simulator and a mock ICM messenger for local cross-chain tests. Verify the current package names.
- Deploy via `forge script` with encrypted keystores (`cast wallet import`), never raw keys. Verify contracts on the explorer.
- Run ethskills `security` and `audit` checklists before any Fuji deploy.

## Testing strategy — TypeScript E2E

- Unit and integration (TS): Vitest, with ports faked through DI.
- **E2E (TS)** in a root `e2e/` workspace:
  - Protocol E2E: Vitest + viem against `anvil` (Fuji fork) and local simulators. It covers the full 402 → pay → 200
    flow, the cross-chain settlement flow, and the Demo 3 config matrix (each config combination is a test case).
  - UI E2E: Playwright against the frontend, with a test wallet.
  - Testnet smoke tests: real Fuji, Sepolia, and L1, run manually or nightly, never required in PR CI.
- The E2E suites build their own container via a test composition root. There are no special code paths for tests.

## Git and GitHub workflow (non-negotiable)

`CONTRIBUTING.md`, the issue forms, and the PR template already exist. They are the source of truth; follow them.
Summary:

- **Flow: issue → branch → commits → PR → merge.** Every task in the plan maps to exactly one issue.
- **Issues are tiny**: the `Task` form (What · Done when) or the `Bug` form (What happened · Expected). Less is more.
- **Gitflow**: `main` (tagged releases) and `develop` (integration); `feature/<issue>-<slug>`, `release/x.y.z`,
  `hotfix/<issue>-<slug>`. No direct pushes to `main` or `develop`.
- **Conventional Commits v1.0.0** (https://www.conventionalcommits.org/en/v1.0.0/): `<type>(<scope>)[!]: <description>`.
  `feat` → MINOR, `fix` → PATCH, and `!` or a `BREAKING CHANGE:` footer → MAJOR. Scope = module; the footer is
  `Refs #<issue>`. Enforce with commitlint + a commit-msg hook; generate the changelog and SemVer tags from commits.
- **PRs**: English, one issue each, small; the body uses the template with `Closes #<issue>`; squash into `develop`.
- **English everywhere**: code, comments, identifiers, docs, commits, issues, PRs.
- **No AI attribution anywhere**: no `Co-Authored-By`, no "Generated with ..." footers, no AI credits in code or docs.
- **Branch protection** on `main` and `develop`: PR required and CI green.
- **CI (GitHub Actions)**: per-workspace lint, typecheck, Vitest, `forge fmt --check` + `forge build` + `forge test`,
  protocol E2E against anvil, Playwright E2E, frontend build. Path filters so each demo only runs its own jobs;
  Demo 3 also runs when Demo 1, Demo 2, or the shared packages change.

## Proposed structure (validate or improve; justify changes)

```
hackatwin-x402-team1-avalanche/
├── docs/                       # Markdown content (this prompt, PLAN.md, references, diagrams, talk run-of-show)
├── apps/web/                   # single frontend: landing, guided path, /demo-1, /demo-2, /demo-3
├── apps/docs/                  # Docusaurus site; docs.path → ../../docs (content stays in docs/)
├── demos/
│   ├── 01-x402-twin/
│   │   ├── contracts/          # Foundry: MockARGt (ERC-20 + ERC-3009), deploy scripts
│   │   ├── seller-api/         # x402-protected API (own composition root)
│   │   ├── buyer-agent/        # agent: ERC-8004 identity + x402 client (own composition root)
│   │   └── module.ts           # registerX402Module(container, config): public entry for Demo 3
│   ├── 02-l1-crosschain/
│   │   ├── l1/                 # platform-cli scripts, genesis, L1 config
│   │   ├── contracts/          # Foundry: CCIP sender, Fuji broker (CCIP→ICM), L1 settlement
│   │   ├── payment-agent/      # cross-chain payment agent (own composition root)
│   │   └── module.ts           # registerCrossChainModule(container, config)
│   └── 03-agentic-crosschain-commerce/
│       ├── demo3.config.ts     # typed config: selects modules + adapters
│       └── main.ts             # composition root only, no domain logic
├── packages/
│   ├── core/                   # DI container, domain types, port interfaces, config schemas
│   ├── chains/                 # chain registry: Fuji, Sepolia, Arbitrum (read-only), TwinPay L1; Twin contract addresses
│   ├── agent-kit/              # agent adapters (wallet, ERC-8004, x402, LLM) implementing core ports
│   └── ui/                     # design tokens + components (Twin × team1 × HACKATWIN)
├── e2e/                        # TS E2E: protocol (Vitest + viem + anvil), UI (Playwright), testnet smoke
├── .github/                    # workflows (CI), PR + issue templates, CODEOWNERS
├── .mcp.json                   # Avalanche MCP (project scope)
├── .claude/                    # settings.json (ethskills plugin), skills/avalanche/
├── AGENTS.md                   # same tooling pointers for non-Claude agents
├── CONTRIBUTING.md             # gitflow + commit conventions
└── .env.example
```

## Agent tooling already wired in the repo (showcase it in the talk)

- `.mcp.json` → Avalanche MCP (read-only): https://build.avax.network/api/mcp. Tools: `docs_search`, `docs_fetch`,
  `cli_lookup_command`, `rpc_lookup_method`, `platform_get_*`, `info_*`, `blockchain_*`, `github_*`.
- `.claude/settings.json` → ethskills plugin. `.claude/skills/avalanche/` → local Avalanche skill
  (no official Avalanche skill package exists). `AGENTS.md` → the same pointers for other agents.
- Avalanche docs for LLMs: https://build.avax.network/docs/tooling/ai-llm · https://build.avax.network/llms.txt ·
  https://build.avax.network/llms-full.txt
- ICM / ICTT: https://build.avax.network/docs/cross-chain/icm-contracts/deep-dive.md ·
  https://build.avax.network/console/icm/setup · https://build.avax.network/console/ictt/setup
- Platform CLI: `curl -sSfL https://build.avax.network/install/platform-cli | sh` then `platform-cli --help`
  (releases: https://github.com/ava-labs/platform-cli/releases)
- ethskills (https://ethskills.com/): `/plugin marketplace add austintgriffith/ethskills` and
  `/plugin install ethskills@ethskills`. Use `standards` (x402, ERC-8004, EIP-3009), `wallets`, `security`,
  `testing`, `addresses`, `frontend-ux`, `orchestration`.
- x402 on Avalanche (academy): https://build.avax.network/academy/blockchain/x402-payment-infrastructure

## Known facts (verify before use)

| Item | Value | Source confidence |
|---|---|---|
| Fuji chain ID | 43113 | official |
| Fuji USDC | `0x5425890298aed601595a70AB815c96711a31Bc65` | Coinbase x402 + Avalanche docs |
| ERC-8004 Identity (Fuji) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | unofficial; check github.com/erc-8004/erc-8004-contracts |
| ERC-8004 Reputation (Fuji) | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | unofficial; same check |
| x402 facilitators on Fuji | thirdweb (used by x402-starter-kit), Ultravioleta DAO, PayAI, 0xGasless, x402-rs (self-host) | Avalanche integrations pages |
| ccip-icm networks | Sepolia → Fuji (43113) → Dispatch L1 (779672) | repo README |
| Twin stables (ARGt, BRAt, COLt, PERt, MEXt, BOLt, CHLt) | Arbitrum 42161; addresses in `docs/references/twin-finance-contracts.md` | unverified (user-supplied) |
| Twin on Avalanche | registry reportedly lists deployments; my web search found none | **must verify** |
| Arbitrum chain ID | 42161 | official |

## Required output: `docs/PLAN.md`

1. Architecture overview starting from `docs/architecture.excalidraw` (keep its style: orthogonal arrows, no
   arrow crossing a box), plus one flow per demo (402 → pay → 200; Sepolia → Fuji → L1; Demo 3 composed flow) and
   a DI diagram showing each composition root and the ports and adapters it wires.
2. Final repo structure with each module's responsibility in one line.
3. Phased milestones (repo setup: CI, commitlint, Docusaurus at `apps/docs` → scaffold + `packages/core` DI → shared packages →
   Demo 1 → Demo 2 → Demo 3 → frontend → E2E hardening → rehearsal → `release/1.0.0`), each with acceptance criteria,
   a demoable result, and the tests that prove it.
4. Task breakdown per phase, small enough for one agent session each, with dependencies. Write each task as a
   ready-to-file `Task` issue: a title (conventional style), What (1–2 lines), and Done when (checkboxes). Add its
   branch name. Nothing more.
5. Decisions with tradeoffs: DI container (hand-rolled vs library), facilitator choice, ERC-8004 vs alternative,
   L1 genesis/precompiles, ICTT vs message-only, Demo 3 settlement (Fuji + cross-chain vs direct L1 via x402-rs),
   local cross-chain simulation for E2E, FX source (Curve vs DIA vs fixed), and mock ARGt vs real Twin token on Avalanche
   (if the registry confirms a deployment).
6. Risks + mitigations (facilitator token support, testnet faucets, CCIP lane availability, live-demo failure).
7. Talk run-of-show: minute-by-minute script mapped to frontend screens and fallbacks.
8. Open questions for the humans, one per line. Do not guess answers.
