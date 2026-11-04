# Tasks: Demo 1, x402 + Twin on a C-Chain fork (M5)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | about 3,750 authored over 13 to 14 PRs (150 to 400 each, `pnpm-lock.yaml` excluded) |
| 400-line budget risk | High in total, Medium per PR (PRs 2, 4, 7, 11 are closest to 400) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 to PR 13 (PR 2 may split into 2a `feature/guarded-sdk-clients` then 2b) |
| Delivery strategy | ask-on-risk, resolved by standing preference: split anything over budget, no `size:exception` |
| Chain strategy | stacked (PR 1 from `feature/pnpm-quote` = PR #62; each next from the previous; all PRs target `develop`) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Note: "stacked-to-main" is the guard literal. Bases are the previous PR branch, targets are `develop`. A PR over 400 lines is split at the listed seam, never excepted.

### Suggested Work Units

Test commands use the root scripts; "fork" means `pnpm test:fork` (needs anvil and an upstream RPC serving `N`). No unit needs `ANTHROPIC_API_KEY`; CI and E2E use `--scripted`.

| Unit | Goal | PR (branch) | Est. lines | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|---|
| 1 | Config, event, catalog deltas | 1 `feature/demo-1-config` | 200 | `pnpm vitest run packages/config packages/core` | N/A: pure schema and codec | config, core event, `.env.example`, ADR 0008 |
| 2a | Guarded SDK clients, R9 | 2a `feature/guarded-sdk-clients` | 250 | `pnpm vitest run packages/chains test/dependency-rule` | N/A: guard proven by fake transports | `guarded-clients.ts`, `chain-client.ts`, R9, ADR 0007 |
| 2b | Fork scripts, keystore encrypt, CI fork job | 2b `feature/demo-1-fork-scripts` | 320 | `pnpm vitest run packages/chains demos/01-x402-twin` | `pnpm demo1:fork` (live fork) | `anvil.ts`, `encrypt.ts`, `scripts/`, `state.ts`, CI job |
| 3 | Module, tokens, funding | 3 `feature/demo-1-fund` | 280 | `pnpm vitest run demos/01-x402-twin/adapters/funding` | `pnpm demo1:fund` (live fork); fork test | `module.ts`, `tokens.ts`, `funding.ts`, `fund.ts` |
| 4 | Facilitator | 4 `feature/x402-facilitator` | 350 | `pnpm vitest run demos/01-x402-twin/adapters/facilitator-app` | `pnpm demo1:facilitator` + fork settle test (live fork) | facilitator files |
| 5 | Seller API | 5 `feature/x402-seller-api` | 330 | `pnpm vitest run demos/01-x402-twin/adapters/seller-app` | `pnpm demo1:seller` (live fork) | seller files |
| 6 | x402 client gateway | 6 `feature/x402-client` | 300 | `pnpm vitest run packages/agent-kit/src/x402` | N/A: fake engine and fetch | `agent-kit/src/x402`, two deps |
| 7 | ERC-8004 identity, register | 7 `feature/erc8004-identity` | 350 | `pnpm vitest run packages/agent-kit/src/identity` | `pnpm demo1:register` + fork test (live fork) | identity files, `registration.ts`, `register.ts` |
| 8 | Budget policy | 8 `feature/budget-policy` | 150 | `pnpm vitest run packages/agent-kit/src/policy` | N/A: pure policy | `budget-policy.ts` |
| 9 | Claude LLM adapter | 9 `feature/claude-llm` | 300 | `pnpm vitest run packages/agent-kit/src/llm/claude-llm` | Optional live Claude run (`ANTHROPIC_API_KEY`) | `claude-llm.ts` |
| 10 | Agent runner, scripted LLM | 10 `feature/agent-runner` | 250 | `pnpm vitest run packages/agent-kit/src/runner` | N/A: scripted LLM | `runner/`, `scripted-plan-llm.ts` |
| 11 | Buyer agent | 11 `feature/demo-1-buyer-agent` | 380 | `pnpm vitest run demos/01-x402-twin/buyer-agent` | `pnpm demo1 --scripted` (live fork); Claude run needs key | `buyer-agent/`, `balances.ts` |
| 12 | Module wiring finish, runbook | 12 `feature/demo-1-module` | 200 | `pnpm vitest run test/demo-1-runbook` | N/A: docs and import test | runbook test, `docs/demos.md` |
| 13 | E2E | 13 `feature/e2e-demo-1` | 320 | `pnpm vitest run --project fork e2e/protocol/src/demo-1.test.ts` | Same, live fork, `--scripted`, no key | e2e files |

Split seams if a PR passes 400: PR 4 and 5 put fork test in a follow-up; PR 7 split adapter vs `register.ts`; PR 11 split `balances`/`format` vs `main`/`tools`.

## Phase 1: Foundation (PRs 1, 2a, 2b, 3)

PR 1
- [x] 1.1 RED then GREEN: `KEYSTORE_DIR` schema, `forkStaticsSchema` + `CCHAIN_FORK_BLOCK`, `loadProfile(..., { llm })` in `packages/config/src/{env,profiles,load-profile}.ts`. Test `load-profile.test.ts`: abs path carried, `.demo1` rejected; forkBlock missing/0/-1 rejected; Claude without key names `ANTHROPIC_API_KEY`, scripted passes, model default `claude-sonnet-5-5` (config-profiles). ~90
- [x] 1.2 `run.started` gains `llm`: `packages/core/src/domain/agent-event.ts` + codec test (core-domain-ports). ~30
- [x] 1.3 `.env.example`, `.gitignore` (`.demo1/`), `pnpm-workspace.yaml` catalog pins (@x402 2.29.0, hono 4.13.16, @hono/node-server 2.1.6, @anthropic-ai/sdk 1.4.0, viem 2.57.16), ADR 0008 (ADR 0008 moved to the scripted-LLM PR). ~80

PR 2a
- [x] 2.1 RED: guard tests in `packages/chains` (allowlist when refused, local accounts refuse to sign, cheats refused off loopback anvil). 2.2 GREEN `guarded-clients.ts` (`GuardedClients`, `AnvilCheats`); rebuild `chain-client.ts`. ~150
- [x] 2.3 R9 in `test/dependency-rule.ts`: viem client construction banned outside `packages/chains`; ADR 0007. ~100 (chain-client)

PR 2b
- [x] 2.4 RED: `anvilArgs` (non-http upstream and bad port rejected, host loopback, spaces stay one argv element, `shell: false`). GREEN `anvil.ts`. ~90 (Threat: subprocess)
- [x] 2.5 RED: keystore round trip, modes 0700/0600, `wx` no overwrite, output has no 64-hex key; GREEN `keystore/encrypt.ts`, `state.ts`. ~110 (Threat: state files)
- [x] 2.6 `scripts/fork.ts` and `fork-block.ts` (no-op at `N`, exit 1 naming `N`, `syncClock`, `demo1.env`); `fork` Vitest project, CI `fork` job with RPC cache `foundry-rpc-43114-<N>`, pinned Foundry, SIGINT stop; scripts in `package.json`. ~120 (fork-environment; live fork)

PR 3
- [x] 3.1 RED: funding idempotence unit tests (gas under 1 AVAX, shortfall below T, `approve` bounded, balance >= T, allowance == T, persisted `funding.json`); GREEN `adapters/funding.ts`. ~130
- [x] 3.2 `module.ts` (`registerX402Module`, registers only), `tokens.ts` (12 tokens), `scripts/fund.ts`. ~100
- [x] 3.3 Fork test: four roles funded, top up second run no-op (live fork). ~50

## Phase 2: x402 services (PRs 4, 5, 6)

- [x] 4.1 RED `facilitator-app` tests: loopback bind, oversize and malformed bodies 4xx, unsupported network rejected (Threat: HTTP). 4.2 GREEN `facilitator-app.ts`, `sdk-addresses.ts` (constants equal registry), `facilitator/main.ts`. ~220 (x402-facilitator)
- [x] 4.3 Fork settle test plus expired deadline (live fork). ~130
- [x] 5.1 RED `seller-app.test.ts` against the real middleware, fake facilitator: paid body shape, settle failure gives no 200 and no `quote`, oracle error gives 503. 5.2 GREEN `seller-app.ts`, `argt-money-parser.ts`, `seller-api/main.ts`. Verify whether `extra.quote` reaches the 402 body, else rate source in route description. ~330 (x402-seller-api)
- [x] 6.1 RED `payment-gateway.test.ts`: ask `maxAmount + 1` emits `above_max_amount`, signs nothing; allowance shortfall typed error; approval extensions rejected; 200 Settled, else Rejected. 6.2 GREEN `payment-gateway.ts`, `engine.ts`, `errors.ts`; add `@x402/core`, `@x402/evm`. ~300 (x402-client)

## Phase 3: Identity, policy, LLM, runner (PRs 7 to 10)

- [x] 7.1 Verify `getSummary` and `getClients` against `erc-8004-contracts` 2.0.0. 7.2 RED fake-client tests: `Registered` decode, `SelfFeedbackError`, feedback args. 7.3 GREEN `erc8004-identity.ts`, `abi.ts`, `errors.ts`; `adapters/registration.ts`, `scripts/register.ts` (`identities.json`). 7.4 Fork test: reputation count 1 (live fork). ~350 (agent-identity)
- [ ] 8.1 RED `budget-policy.test.ts` at and above both caps; 8.2 GREEN `budget-policy.ts`, `above_max_amount` reason. ~150 (budget-policy)
- [ ] 9.1 Confirm Claude 1.4.0 thinking block shape. 9.2 RED `claude-llm.test.ts` (fake SDK): refusal maps, one 529 then success, always 500 gives `LlmError` without key, thinking replay. 9.3 GREEN `claude-llm.ts`. ~300 (claude-llm; no key needed)
- [ ] 10.1 RED `create-agent.test.ts`: `max-steps` at 3, unknown or invalid tool ends with `error`, refusal and error reasons; `EventChannel.until`. 10.2 GREEN `create-agent.ts`, `event-channel.ts`, `tool.ts`, `scripted-plan-llm.ts`. ~250 (agent-runner)

## Phase 4: Buyer and wiring (PRs 11, 12)

- [ ] 11.1 RED `tools.test.ts`: `buy` with a `cap` key still meets profile caps; `rate_seller` only after a 200 and when `ownerOf` equals paid `payTo`. 11.2 GREEN `buyer-agent/{main,tools,scripted-plan,prompt,format}.ts`, `adapters/balances.ts`; preflight (guard, fork at `N`, clock, identities, funding, services). Run `pnpm demo1 --scripted`. ~380 (demo-1-buyer)
- [ ] 12.1 RED `test/demo-1-runbook.test.ts` fails on unknown script; 12.2 GREEN `docs/demos.md` Demo 1 commands; import test from another workspace. ~200

## Phase 5: E2E (PR 13)

- [ ] 13.1 `e2e/protocol/src/support/fork-setup.ts` (port 8546, `evm_snapshot` per test, fresh keys, `FakePriceOracle` 1658.36 via `child()`). 13.2 `demo-1.test.ts`: 402 to 200, deltas equal quote, one feedback on seller id, reputation 1; ceiling refusal signs nothing (live fork, scripted, no key). ~320
