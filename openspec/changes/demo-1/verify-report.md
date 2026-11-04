```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:4a48eada3552e9d7fdf1300dbb23e9aea371768d000000000000000000000000
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 40/40
scenarios: 86/86
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:1f18be520f9f805ef13abc469323ffe6197dd0365eae1739fa90b2f72be5092a
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:227ac37b553149613b8b51bf8351dd566d12970a7081cbda2fea86b6d65d7057
```

# Verify report: demo-1 (M5)

Change: demo-1. Mode: hybrid. Standard (strict TDD not active). Verified commit: `4a48ead` (tip `origin/feature/e2e-demo-1`, PR #106 stack).

## Completeness

All 13 task groups (22 stacked PRs) are checked in tasks.md and apply-progress ("Remaining: None").

## Execution evidence

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm typecheck` | exit 0, all workspaces |
| `pnpm test` | 43 files, 380 tests passed; coverage lines 98.31%, branches 91.74% |
| `pnpm exec biome check .` | 199 files, no issues |
| `pnpm test:fork` (local anvil, loopback) | 5 files, 11 tests passed (65 s) |
| Cleanup | no anvil process; ports 8545, 8546, 4020, 4021 free |

CI: all 22 PRs (#64 to #106 list) show only SUCCESS checks (10 to 11 each; #94 has 22 after close and reopen). All PRs still OPEN.

## Spec compliance (12 specs, 40 requirements, 86 scenarios)

Every scenario has a passing covering test except one NOT-VERIFIABLE (counted as completed in the envelope because the caller defined it as not a failure: the real Claude path cannot run without a key). Key evidence (test names; files under the worktree):

- config-profiles: `packages/config/src/load-profile.test.ts` (key required for claude, scripted needs none, no llm field, absolute/relative KEYSTORE_DIR, raw key, remote RPC, forkBlock missing/0/-1, static field). PASS all 11.
- core-domain-ports: `packages/core/src/domain/agent-event.test.ts` (2^53 string, unknown version, `llm: gpt` rejected). `run.started` emits llmName in `packages/agent-kit/src/runner/create-agent.ts:36`. PASS 4.
- chain-client: `chains/src/{write-guard,chain-client,guarded-clients,anvil-cheats}.test.ts` (public RPC, loopback non-anvil, local anvil, SDK signer refused with no write method, cheats refused/allowed). PASS 6.
- fork-environment: `scripts/fork.test.ts`, `fork.fork.test.ts` (start at N, no-op rerun, N not served), `chains/src/state.test.ts` (keystores, 0600, existing kept), env-wins test in fork.test.ts, `adapters/funding.test.ts` and `funding.fork.test.ts` (fund, rerun no tx, top-up exactly p, allowance/balance named). Non-anvil refusal: guard tests plus `preflight.test.ts`. PASS 13.
- x402-facilitator: `facilitator-app.test.ts`, `sdk-addresses.test.ts` (names proxy and Permit2 on drift), `facilitator.fork.test.ts` (settle, expired). PASS 8.
- x402-seller-api: `seller-app.test.ts` (convert, 503 on oracle error, 402 with maxTimeoutSeconds 30 and source, paid body, failed settlement); `seller-app.ts:11` disclaimer. PASS 6.
- x402-client: `payment-gateway.test.ts` (4 events order, Rejected, allowance enough/short, above/at ceiling, fake gateway), `engine.test.ts`. PASS 7.
- agent-identity: `erc8004-identity.test.ts` (Registered, no event, 8-arg feedback, SelfFeedbackError at `erc8004-identity.ts:64`, count), `registration.test.ts` (two ids, rerun no tx), `register.fork.test.ts` (live feedback, reputation 1). PASS 7.
- budget-policy: `budget-policy.test.ts`, `payment-gateway.test.ts` (above_max_amount, policy untouched), `buyer-agent/tools.test.ts` (cap key stripped). PASS 6.
- agent-runner: `create-agent.test.ts` (run, unknown tool, invalid input, max-steps 3 and default 8), scripted fake, offline suite. PASS 5.
- claude-llm: `claude-llm.test.ts` (auto, default and config model, reasoning order, refusal, one 529 then success, exhausted without key leak, missing key names ANTHROPIC_API_KEY). PASS 7 (see note).
- demo-1-buyer: `buyer-agent/tools.test.ts`, `scripted-plan.test.ts`, `preflight.test.ts`, `format.test.ts`, `test/demo-1-runbook.test.ts`, `module.test.ts`, `e2e/protocol/src/demo-1.fork.test.ts` (paid with exact deltas, one feedback, ceiling refusal signs nothing), CI cache key `.github/workflows/ci.yml:202` (`foundry-rpc-43114-<N>`). "No key" scenario (`pnpm demo1` exits naming the variable before chain call) covered by `claude-llm.test.ts` plus main.ts wiring and manual run in apply-progress. "Full run with Claude": NOT-VERIFIABLE (no ANTHROPIC_API_KEY); the real Claude path is covered only by fake-fetch unit tests, which pass. PASS 9 of 10.

## Design deviations judged

All acceptable, none breaks a spec: PR splits (22 PRs instead of 13, all under about 400 lines); `cheats()` moved to the anvil PR; N = 99_388_000; demo1.env writes read RPC defaults; `keystoreNamedInEnv` (R6 respected); `getBlockNumber({cacheTime:0})` fix; `composeRoot`/`ports.ts` added; `isAuthorizedOrOwner` pre-check (spec only requires typed error before or on submission); typed gateway errors instead of return values (spec requires only no-signing and events); `BudgetPolicy(budget, emit, now)` signature; policy.record after a settled payment (fixes a latent total-cap gap); E2E file named `demo-1.fork.test.ts` (needed by the fork project pattern; tasks.md and design name `demo-1.test.ts`).

## Issues

CRITICAL: none.

WARNING:
1. Real Claude path unverified (no key); adaptive thinking acceptance by `claude-sonnet-5-5` not confirmed.
2. tasks.md/design still name `demo-1.test.ts`; actual file is `demo-1.fork.test.ts` (doc drift, fix at archive).
3. Envelope hashes are sha256 of a rerun's `pnpm test` and `pnpm typecheck` output (both exit 0); the earlier runs were not captured.
4. All 22 PRs remain open and stacked on `develop`; merge order matters.

SUGGESTION:
1. Run `pnpm demo1` once with a real key before the demo.
2. ADR 0008 and the `Tokens.Buyer/Balances` typing are noted in apply-progress; consider mirroring in design at archive.

## Verdict

PASS WITH WARNINGS (0 CRITICAL, 4 WARNING, 2 SUGGESTION). Ready for archive.
