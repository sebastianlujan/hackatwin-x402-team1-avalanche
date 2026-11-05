```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3789889e66e6c28c8c8e1e91b6517bb89bc6e9f82c2398e4a76f3c4d391f563e
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 43/43
scenarios: 93/93
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:e955e34384145468c13643388e74948603132bf2add0d044b5cedce17d6c9b9d
build_command: pnpm --filter @hackatwin/web build
build_exit_code: 0
build_output_hash: sha256:3b62ff7bfe72cfcfcf78248acfa05148d4580476316bdbd57a262b9b95749e36
```

## Verification Report

**Change**: web-demo-1 (PLAN M10 subset T10.1 to T10.6)
**Version**: N/A
**Mode**: Standard (Strict TDD not active, Q21)
**Verified tip**: `origin/feature/web-first-tx` at fb41e59 (PR #220), detached worktree, no code changes.

### Completeness

| Metric | Value |
|---|---|
| Tasks total | 59 |
| Tasks complete | 58 |
| Tasks incomplete | 1 (2.5 acceptance experiment, deliberately open) |
| Requirements | 43 (40 verified PASS, 3 partial or NV, counted complete in the envelope as non-failing per the verify brief) |
| Scenarios | 93 (89 verified PASS, 4 partial or NV, counted complete in the envelope as non-failing per the verify brief) |

### Execution evidence

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm typecheck` | exit 0 (root tsc plus every workspace) |
| `pnpm lint` (biome) | exit 0, 349 files |
| `pnpm test` | exit 0, 85 files, 658 tests passed; coverage 97.63% stmts, 91.94% branches. Rolldown "Failed to parse .sol" lines are coverage-provider noise for Solidity files, not failures |
| `pnpm vitest run test/dependency-rule.test.ts apps/web/scripts` | exit 0, 27 tests (R1 to R11, scan-static) |
| `pnpm --filter @hackatwin/web build` (CI sentinel env) | exit 0, 13 routes |
| `pnpm --filter @hackatwin/web build` (no env at all) | exit 0 |
| `node apps/web/scripts/scan-static.ts` | exit 0 clean; with a planted sentinel exit 1 |
| `pnpm --filter docs build` | exit 0 |
| CI on PRs #176 to #220 (23 PRs) | all checks SUCCESS, including web build, docs build, fork, ci-gate; #220 head equals fb41e59 |

### Runtime evidence (local anvil fork only, loopback only)

Throwaway keys in the worktree `.demo1/`; `demo1:fork` (block 99388000), `demo1:fund`, `demo1:register` (ids 1850, 1851), then `PORT=3100 pnpm web:demo1` (web dev server). No transaction left localhost.

| Check | Result |
|---|---|
| Listeners | anvil 127.0.0.1:8545, seller 127.0.0.1:4021, facilitator 127.0.0.1:4020, web 127.0.0.1:3100; all loopback |
| GET `/api/runs` | 405, no run created |
| POST `llm:"claude"` without key | 422 `{"error":"the server has no ANTHROPIC_API_KEY"}` |
| POST bad llm | 400 |
| POST scripted | 202 with run id |
| Second POST while active | 409 with the active run id |
| SSE | 200, `text/event-stream`, `cache-control: no-cache, no-transform`, `retry: 1000`, ids 1..15 |
| `Last-Event-ID: 4` after finish | frames 5..15 |
| Mid-run drop at seq 8, resume with `Last-Event-ID: 8` | frames 9..15; run 3 moved exactly one payment |
| Payments | per-run seller delta 16.583799482408484898 ARGt; after runs 1, 2, 3 seller = 1x, 2x, 3x exactly (no second payment from resume or reload) |
| New POST after `run.finished` | 202, new id |
| Unknown run events | 404 |
| `/demo-1` SSR `initialRunId` | latest run id (store shared across page and route via globalThis) |
| `/`, `/path/avalanche`, `/path/first-tx`, `/path/identity`, `/demo-1`, `/demo-2`, `/demo-3`, `/path/production`, `/path/built-by-agents` | all 200 |
| `/path/identity` | live ids 1850 and the agent owner address, no "offline" |
| Leak scan (page HTML, 16 `/demo-1` chunks, SSE bodies, run record, errors) | no `8545`, `anvil_`, `KEYSTORE`, key material, password, or absolute path. The only `ANTHROPIC_API_KEY` occurrence is the spec-mandated Claude-disabled reason |
| `.next/static` production scan for `8545`, `anvil_`, `KEYSTORE` | no match |
| Shutdown | 8545, 8546, 4020, 4021, 3100 confirmed free; worktrees removed |

### Spec compliance matrix (43 requirements, 93 scenarios)

Legend: PASS (covering test passed, runtime evidence added where noted), PARTIAL, NV (not verifiable here).

#### agent-event-stream (8 req, 15 scen): 14 PASS, 1 PARTIAL

| Requirement and scenario | Status | Evidence |
|---|---|---|
| One envelope: live round trip, same schema, unknown version | PASS | `apps/web/src/lib/envelope.test.ts:7,13,19` |
| Runs start only by POST: GET never starts | PASS | `handlers.test.ts:64`; runtime GET 405 |
| Claude without a key | PASS | `handlers.ts:24`, `handlers.test.ts:36`; runtime 422 |
| One active run: double click, after the run | PASS | `run-store.test.ts:41,50`; runtime 409 then 202; payments 1x per run |
| Resume: reconnect mid run, dev reload | PASS | `sse.test.ts:36`, `run-store.test.ts:105,131`; runtime resume 5..15 and 9..15 |
| Stream transport headers | PASS | `sse.ts:14-18`, `sse.test.ts:19`; runtime headers |
| Preflight: seller down, fork guard refusal | PASS | `handlers.test.ts:44,55`, `entry.test.ts:105`; 503 path covered by unit tests only (services were up at runtime) |
| Failed runs end the stream | PASS | `run-store.test.ts:81,94` |
| Replay source: bad line | PASS | `replay-source.test.ts:17` |
| Replay source: "screen shows a Replay label" | PARTIAL | `sourceLabel` exists (`envelope.ts`), frames carry `source: replay`, but no component renders it; replay is not wired anywhere by design. Closes with T10.7 |

#### chain-registry (2 req, 6 scen): 6 PASS

`explorer.test.ts:15,21,28,35,39`; registry JSON diff P14b to P15 empty; module graph is `viem`, `zod`, JSON, no `node:`, `anvil` or `keystore`.

#### ci-workspace-jobs (1 req, 2 scen): 0 PASS, 2 NV

`ci.yml` `web-build` (`if: needs.changes.outputs.web == 'true'`, lines 333-355) and `ci-gate` jq rule (success or skipped only) are correct by inspection, and `web build` ran green on 22 PRs. Neither the failing-build nor the docs-only-skip experiment has run (task 2.5).

#### demo-1-buyer (2 req, 4 scen): 4 PASS

`entry.test.ts:82` (CLI parity), `:105` (PreflightError before write), `:126` (Claude key before chain call), `:137` (relative KEYSTORE_DIR names variable); `packages/config/src/env.ts:24`.

#### demo-1-screens (8 req, 15 scen): 15 PASS

`Demo1Screen.test.tsx:29,36,54,62`, `starter.test.ts:10,28,43`, `Timeline` tests, `Panels.test.tsx:34-100`, `demo-1-state.test.ts`, `IdentityCard.test.tsx:12,42`, `identity.test.ts:10`; reload and no second payment shown at runtime. Drop and `Last-Event-ID` is native EventSource plus reducer dedupe (`demo-1-run.tsx:37-41`, `starter.test.ts:53`) with runtime confirmation of the server side.

#### design-tokens (5 req, 9 scen): 9 PASS

`tokens.test.ts:41-66`, `atoms.test.tsx:23-53`, `assets.test.ts:16`, docs build exit 0.

#### first-fuji-tx (4 req, 10 scen): 9 PASS, 1 NV

`first-tx.test.ts`, `first-tx-state.test.ts`, `FirstTxPanel.test.tsx:42-80` cover states, wrong network, switch rejected, no wallet, explorer link only with a hash, pre-sent set and unset. Happy path with a real injected wallet and a real Fuji send is NV (unit tests of `buildFirstTx` and states pass).

#### guided-path (4 req, 8 scen): 8 PASS

`talk-path.test.ts:17,26-68` (parses PLAN section 7), `talk-screens.test.tsx`, `LandingTemplate.test.tsx`, `copy.test.ts:30`; all 9 routes 200 at runtime.

#### web-shell (5 req, 8 scen): 8 PASS

`root.test.ts:10` plus a no-env production build exit 0; R10/R11 tests; `wallet-config.test.ts:9,13`; `ci.yml` `ci-gate.needs` lists `web-build`; scan exit 1 on a planted sentinel; runtime leak scan.

#### workspace-dependency-rule (4 req, 16 scen): 16 PASS

`test/dependency-rule.test.ts:82,96,127,134,217,233,256` and the real-repo test at `:35`.

### PLAN Done-when map

| Item | Box | State |
|---|---|---|
| T10.1 | Tokens read by web and docs | DONE (8.2, 8.3, docs build) |
| T10.1 | Atoms props only | DONE (9.1) |
| T10.1 | Logos only after O4 | DONE, stays true until O4 (9.3) |
| T10.2 | No hooks or ports in presentational files | DONE (R10) |
| T10.2 | Secrets stay out of the bundle | DONE (R11, scan, runtime) |
| T10.2 | Builds in CI | DONE by wiring and green jobs; 2.5 experiment open |
| T10.3 | Routes match section 7 | DONE |
| T10.3 | Keyboard navigation | DONE |
| T10.3 | Copy follows O14 | DONE (English, one module) with copy WARNINGS below |
| T10.4 | Explorer URL from chains | DONE |
| T10.4 | Pre-sent fallback | DONE (unset until rehearsal) |
| T10.4 | Wrong network | DONE at logic level; real wallet NV |
| T10.5 | One schema and UI | DONE |
| T10.5 | Dropped stream resumes without rerun | DONE |
| T10.5 | Replays labeled on screen | OPEN until T10.7 |
| T10.6 | Timeline beside strip | DONE |
| T10.6 | Quote source and "market rate, not official" | DONE |
| T10.6 | Balances and fork hashes without links | DONE |

### Design coherence and deviations

| Deviation | Judgment |
|---|---|
| Env loading in `next.config.ts` (`process.loadEnvFile`, skipped for the production build) instead of `--env-file-if-exists` | ACCEPT. Keeps "build needs no env" (no-env build exit 0), shell wins, R6 stays green. Design D8 should be amended |
| Loopback binding `next dev/start -H 127.0.0.1` | ACCEPT, strengthens security. Runbook says `localhost:3000` (SUGGESTION) |
| `agentRules: false` | ACCEPT, cosmetic |
| Scan strips the exact phrase `the server has no ANTHROPIC_API_KEY` | ACCEPT with spec reconciliation (WARNING): web-shell "Static scan" literally forbids the name; the UI spec requires naming it. Phrase is pinned by a test |
| Splits P11a to P11e, P12a/b, P14a/b, P16a/b | ACCEPT, every PR under 400 lines, named seams |
| `lib/run-record.ts` not in the design | ACCEPT, needed for balances; design should list it |
| Task 2.5 open | Judged WARNING, see below |
| wagmi 3 `useConnection` | ACCEPT, API rename, state logic tested |
| viem type bridge in `wallet-config.ts` (`as unknown as Chain`) | ACCEPT with SUGGESTION: caused by two viem installs (TypeScript 5.9.3 pin in web); the cast hides type drift |
| Store keeps slot `starting` until preflight resolves | ACCEPT, stronger than design for "one active run" |

### Copy accuracy (`apps/web/src/content/copy.ts` against decisions.md, demos.md, twin-finance-contracts.md)

| Claim | Verdict | Corrected wording |
|---|---|---|
| `landing.cards.items[0]` "The ARGt token and the TwinPay L1 that Demos 2 and 3 run on." | INACCURATE (WARNING). Demos 2 and 3 use Circle testnet USDC until Twin deploys ARGt on Fuji (Q7, Q13, Q17, "No ARGt on testnets"); TwinPay L1 is built and self-hosted by this project (Q15, Q19), not issued by Twin | "ARGt, the Argentine peso token Demo 1 pays with on a local fork of the C-Chain." |
| `landing.faq` "Who wrote the code? Twin and team1 direct it; agents write most of the repository." | UNSUPPORTED (WARNING). Docs say co-presented by Twin and team1 and that agents build the repo; nothing says Twin directs the code | "team1 directs it; agents write most of the repository." |
| `landing.hero.title` "Autonomous payments on an Avalanche L1" | OK, matches the talk title; Demo 1 itself runs on a C-Chain fork (SUGGESTION to keep this in mind for the lead) | none |
| `demo1.lead` "An agent buys one ARGt quote over x402..." | Imprecise (SUGGESTION). The agent buys an API response priced in ARGt | "An agent pays ARGt over x402 for one API response, on a local fork of the Avalanche C-Chain." |
| `production` "Twin moves ARGt between chains with a LayerZero OFT adapter that holds the minter and burner role." | OK (verified adapter on C-Chain, Q18) | none |
| `production` "Next: if Twin deploys official ARGt on Fuji, Demos 2 and 3 switch ... by configuration." | OK (Q17) | none |
| `landing.faq` real money, local fork, chain ID | OK (Q17, Q20, C1) | none |
| `avalanche` Primary Network, L1, ACP-77 text | NOT-VERIFIABLE from the three docs; generally accurate | none |
| `builtByAgents` `.mcp.json`, skills, issue to PR flow | OK (`.mcp.json`, `.claude/skills`, CONTRIBUTING.md) | none |
| `placeholders` Demo 2 and 3 "not built yet" | OK today; must change with T10.7 and T10.8 | none |

### Security pass

| Item | Result |
|---|---|
| Secrets in `.next/static` | PASS (scan clean, planted sentinel fails, manual grep clean) |
| Fork write guard (ADR 0007) server side | PASS: `root.ts` is `server-only`, the client receives only serialized events and run records; no RPC URL or cheat name in any page, chunk or frame |
| Loopback binding | PASS: all five listeners 127.0.0.1 |
| Error redaction | PASS: `redact()` on 503 bodies and on `run.finished` messages (`run-store.ts:56-58`, `handlers.ts:33`); unit tests only for the 503 path |
| Double payment | PASS: POST only, synchronous slot reservation, SSE and GET never start, payment counts exact at runtime |
| Drive-by POST | SUGGESTION: `request.json()` ignores content type and Origin, so any local web page can start a run with a simple cross-origin POST (a Claude run would spend API credit) |

### Issues

**CRITICAL (0)**

None.

**WARNING (5)**

1. Task 2.5 stays open: the CI scenarios "Failing build" and "Unrelated change" were never exercised. By inspection they hold (`web` filter excludes `docs/**`; `ci-gate` accepts only success or skipped and lists `web-build`), and the job is green on 22 PRs. The skill treats an unchecked core task as CRITICAL; this is judged WARNING because the task is an acceptance experiment recorded as open by design and the wiring is verified. Close it at archive as "verified by construction", or run one throwaway-branch experiment.
2. Landing "Twin" card is inaccurate (see Copy accuracy).
3. FAQ "Twin and team1 direct it" is unsupported.
4. Replay label on screen is not rendered anywhere; scenario "Replay labeled" is PARTIAL until T10.7 (tracked, matches the spec traceability note).
5. The scan exemption phrase contradicts the literal web-shell spec; amend the spec text at archive so the exemption is documented.

**SUGGESTION (6)**

1. Add a fork RPC URL sentinel (`CCHAIN_FORK_RPC_URL`) to the CI `web-build` env and `SENTINELS`; today the spec's "fork RPC URL" is covered only through `anvil_`.
2. Origin check on `POST /api/runs`.
3. Runbook `docs/demos.md:79` says `localhost:3000`; the server binds `127.0.0.1`, so write `http://127.0.0.1:3000/demo-1`.
4. Single `viem` install to remove the cast in `wallet-config.ts`.
5. Update design.md with `run-record.ts` and the D8 env-loading change.
6. Reword `demo1.lead` (see Copy accuracy).

### Not verifiable here

Real Claude path (unit tests with fakes pass; 422 path ran live); real Fuji wallet send; the 503 preflight path against a live outage; open items after rehearsal (pre-sent hash, last-known ids), O4 logos, O13.

### Verdict

PASS WITH WARNINGS. 0 CRITICAL, 5 WARNING, 6 SUGGESTION. Next: sdd-archive after the orchestrator accepts WARNING 1 and the copy fixes (WARNINGS 2 and 3) are scheduled.
