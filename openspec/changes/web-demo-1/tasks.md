# Tasks: Web app through Demo 1 (M10, T10.1 to T10.6)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | about 4,600 authored (tests included, lockfile excluded), 16 PRs of 170 to 395 |
| 400-line budget risk | High as one change; Low to Medium per PR after the split |
| Chained PRs recommended | Yes |
| Suggested split | P1 to P16, one linear queue |
| Delivery strategy | ask-on-risk, resolved by the standing preference: split at named seams, no size:exception |
| Chain strategy | stacked-to-main (P1 branches from `feature/constructor-zero-checks`, PR #174; each next from the previous; all PRs target `develop`) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Strict TDD is off (Q21). Every task carries its tests in the same PR. Forecasts are authored lines (additions plus deletions).
If a PR measures over 400, split at the named seam. Never use size:exception.

### Suggested Work Units

| Unit | Goal (design slice) | Lines | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| P1 | Next scaffold and spikes (1a) | 230 | `pnpm --filter @hackatwin/web build && pnpm --filter @hackatwin/web typecheck` | `next build` with no env | `apps/web` scaffold files |
| P2 | Guardrails: R10, R11, scan, CI (1b) | 360 | `pnpm vitest run test/dependency-rule.test.ts apps/web/scripts` | `web-build` job on the PR | rule block, scan script, CI job |
| P3 | Envelope, redact, store (2a) | 320 | `pnpm vitest run apps/web/src/lib apps/web/src/server/run-store` | N/A: pure units with fake `StartedRun` | three lib and server files |
| P4 | SSE, handlers, replay (2b) | 380 | `pnpm vitest run apps/web/src/server` | N/A: handler factories, `new Request` | sse, handlers, replay files and fixtures |
| P5 | Demo 1 run entry (3a) | 330 | `pnpm vitest run demos/01-x402-twin` | `pnpm demo1` CLI still runs | demo module barrel and entry |
| P6 | API routes, ADR 0012, R2 exception (3b1) | 250 | `pnpm vitest run test/dependency-rule.test.ts apps/web/test` | N/A: route list and rule snapshots | routes, ADR, rule change |
| P7 | Demo 1 live page (3b2, checkpoint) | 370 | `pnpm vitest run apps/web/src/lib/starter apps/web/src/containers` | Browser checkpoint 7.6 | page, container, starter, scripts |
| P8 | Tokens and docs theme (4a) | 300 | `pnpm vitest run apps/web/test/assets.test.ts` and `pnpm --filter docs build` | docs build | `tokens.css`, docs `customCss` |
| P9 | Atoms (4b) | 300 | `pnpm vitest run packages/ui` | N/A: `renderToStaticMarkup` | `packages/ui/src/atoms*` |
| P10 | Demo 1 state logic (5a) | 240 | `pnpm vitest run apps/web/src/lib/demo-1-state` | N/A: pure reducers over fixtures | `lib/demo-1-state.ts` |
| P11 | Demo 1 screen organisms (5b) | 380 | `pnpm vitest run apps/web/src/components` | Checkpoint 7.6 re-run | organisms and page wiring |
| P12 | Guided path, keys, copy (6) | 390 | `pnpm vitest run apps/web/src/lib apps/web/test` | N/A: pure functions, file reads | `talk-path`, `copy`, static screens |
| P13 | Landing (7) | 330 | `pnpm vitest run apps/web/src/components` | N/A: static markup | landing organisms and template |
| P14 | Identity card (8) | 260 | `pnpm vitest run demos/01-x402-twin apps/web/src/components` | `readDemo1Identities` on the fork | `identity-card.ts` and card organism |
| P15 | Chains `txUrl` and wallet provider (9) | 240 | `pnpm vitest run packages/chains apps/web/test` | N/A: import-graph test | `explorer.ts`, `browser.ts`, provider |
| P16 | First Fuji tx screen (10) | 300 | `pnpm vitest run apps/web/src/lib/first-tx*` | Injected wallet on Fuji, manual | first-tx lib and page |

Seams if a forecast overruns: P2 (CI job after rules), P4 (replay source after handlers), P7 (root scripts and docs after page), P12 (static screens after keys), P13 (FAQ and cards after hero).

## P1 web-scaffold (branch `feature/web-scaffold`, base `feature/constructor-zero-checks`)

- [x] 1.1 Spike: Turbopack with `.ts` specifiers and JSON import attributes; fallback `next build --webpack` in the build script. Record the outcome in `apps/web/next.config.ts` (one-line comment).
- [x] 1.2 Spike: `next typegen && tsc --noEmit` as `typecheck`; fallback commit `next-env.d.ts`.
- [x] 1.3 Spike: add pnpm `allowBuilds` entries (for example `sharp`) to `pnpm-workspace.yaml`; fallback `ignoredBuiltDependencies`.
- [x] 1.4 Catalog D1 versions in `pnpm-workspace.yaml`; edit `apps/web/{package.json,tsconfig.json}`, pin `typescript 5.9.3`, add D8 `dev`/`start` env-file flags.
- [x] 1.5 Create `apps/web/next.config.ts` (D2: `transpilePackages`, `turbopack.root`, `outputFileTracingRoot`).
- [x] 1.6 Create `src/app/{layout,page}.tsx` and `src/server/root.ts` (D5, imports `server-only`); delete `src/index.ts`; add `test/stubs/server-only.ts`, update `vitest.config.ts` (alias, automatic JSX).
- [x] 1.7 Tests: `root.ts` import reads no env; build passes with no env (web-shell "Build without environment").

## P2 web-guardrails (`feature/web-guardrails`)

- [x] 2.1 Rule tests first, in `test/dependency-rule.test.ts`: R10 hook (fail) and clean atom (pass); R11 config, chains root, agent-kit, pricing (fail), `chains/registry` (pass), server file (pass).
- [x] 2.2 Implement R10 and R11 detection in `test/dependency-rule.ts`; violation type and snapshot self-test stay green.
- [x] 2.3 Create `apps/web/scripts/scan-static.ts` plus `scan-static.test.ts` (clean tree passes; planted sentinel, `ANTHROPIC_API_KEY`, `KEYSTORE`, `anvil_` fail; CI sentinels match the script).
- [x] 2.4 Edit `.github/workflows/ci.yml` (D19): `web` and `docs` filters, `web-build` job, add to `ci-gate` needs; root `package.json` `web` script.
- [ ] 2.5 Acceptance: failing build fails the gate; docs-only change skips `web-build` (ci-workspace-jobs).

## P3 web-event-stream-core (`feature/web-event-stream`)

- [x] 3.1 `lib/envelope.ts` plus test: live frame round trip, same schema for `live` and `replay`, `version: 2` error.
- [x] 3.2 `server/redact.ts` plus test: URL and absolute path replaced (D11).
- [x] 3.3 `server/run-store.ts` plus test: 409 with active id, synchronous reservation, seq without gaps, throw yields synthetic `run.finished` `error`, `globalThis` reload keeps the run, balances on the record.

## P4 web-event-stream-http (`feature/web-event-stream-http`)

- [x] 4.1 `server/sse.ts` plus test: headers, `id: seq`, `Last-Event-ID: 4` yields 5..7, close after `run.finished`, abort only unsubscribes.
- [x] 4.2 `server/handlers.ts` plus test: 202, 409, 400, 422 (names `ANTHROPIC_API_KEY`), 503 (names `pnpm demo1:*` or variable), GET never starts, 404, redaction, preflight and fork guard refusals.
- [x] 4.3 `server/replay-source.ts` plus fixtures `replay.jsonl`, `replay-bad-line.jsonl`: all frames `source: replay` with "Replay" label; bad line 3 ends with `run.finished` `error` naming line 3, rendered visibly (D24).

## P5 demo-run-entry (`feature/demo-1-run-entry`)

- [x] 5.1 Tests first in `demos/01-x402-twin`: CLI parity, `PreflightError` before writes, Claude key checked before chain calls, relative `KEYSTORE_DIR` fails naming the variable.
- [x] 5.2 Create `state-dir.ts`; update `state.ts`, `root.ts` (`KEYSTORE_DIR ?? stateDir`), CLI entries `buyer-agent/main.ts`, `facilitator/main.ts`, `seller-api/main.ts`, `scripts/{fork,fund,register}.ts` (D8).
- [x] 5.3 Create `buyer-agent/entry.ts` (`startDemo1Run`, child container, D6) and barrel `index.ts`; point `package.json` `./module` at it; `module.ts` keeps only `registerX402Module` (D7).

## P6 web-live-api (`feature/web-live-api`)

- [x] 6.1 Rule tests: server file with `server-only` importing `@hackatwin/demo-*/module` passes; non-server, no-`server-only`, client, deep and relative imports fail; non-web packages stay forbidden.
- [x] 6.2 Implement R2 exception in `test/dependency-rule.ts`; add demo dependency to `apps/web/package.json`.
- [x] 6.3 `docs/adr/0012-web-imports-demo-modules.md` (design draft) and `docs/adr/README.md` row.
- [x] 6.4 Routes `api/runs/{route.ts,[id]/route.ts,[id]/events/route.ts}` (nodejs, force-dynamic, async `params`); test that the `app/api` list equals these three (no Fuji route, no server-held key).

## P7 web-live-page (`feature/web-live-page`, checkpoint)

- [x] 7.1 `lib/starter.ts` plus test: one POST for two presses, Claude disabled with "the server has no ANTHROPIC_API_KEY", Scripted badge from `run.started.llm`.
- [x] 7.2 `containers/demo-1-run.tsx` (EventSource, "Reconnecting", decode-error state, POST error command text) with component markup tests; no replay control.
- [x] 7.3 `app/demo-1/page.tsx` passes latest run id and Claude availability (D17).
- [x] 7.4 Root scripts `web` and `web:demo1` (D20); update `docs/demos.md`.
- [x] 7.5 Run `pnpm --filter @hackatwin/web build` and the scan.
- [x] 7.6 Browser checkpoint: run `pnpm demo1:fork` (or existing scripts), `pnpm web:demo1`, or `pnpm --filter @hackatwin/web dev`; open `/demo-1`, start a Scripted run, see the live stream through 200 and the ERC-8004 feedback; reload mid run resumes.

## P8 ui-tokens (`feature/ui-tokens`)

- [x] 8.1 CSS tests: contrast at least 4.5:1, no palette literal outside `tokens.css`, accent ink on light.
- [x] 8.2 `packages/ui/src/tokens.css`; `packages/ui/package.json` export; web layout imports it.
- [x] 8.3 Docs: `customCss` via `createRequire`, Infima map in `apps/docs/src/css/custom.css`, `apps/docs/package.json`; `ci.yml` `docs` filter for `packages/ui/**`. Acceptance: docs build.

## P9 ui-atoms (`feature/ui-atoms`)

- [x] 9.1 Tests: atoms render without context, `:focus-visible` on Button and TxLink, Cursor blink only under `no-preference`, TxLink no anchor without URL.
- [x] 9.2 `atoms.css` plus `atoms/{Button,Badge,Cursor,TxLink,CodeTag}.tsx`, export in `src/index.ts`.
- [x] 9.3 `apps/web/test/assets.test.ts`: no logo, Twin, team1, Avalanche or AVAX image or SVG (O4).

## P10 web-demo-1-state (`feature/web-demo-1-state`)

- [x] 10.1 `lib/demo-1-state.ts` plus tests: seq dedupe, happy order, policy refusal, quote from `payment.required` only (healthy, guarded, none), `formatMoney`, balance delta.

## P11 web-demo-1 (`feature/web-demo-1`; delivered as P11a to P11d, see apply-progress)

- [x] 11.1 Organisms: timeline, 402/pay/200 strip, quote panel ("market rate, not official"), balances and fork hashes with no `<a>`; CSS Modules; scenario markup tests.
- [x] 11.2 Wire into `app/demo-1/page.tsx` and container; stream-drop and replay-control checks; rerun checkpoint 7.6.

## P12 web-guided-path (`feature/web-guided-path`)

- [ ] 12.1 Tests first: `TALK_PATH` equals PLAN section 7, page file per path, `nextPath` (next, previous, ends, ignored in input), copy scan, static screens with a throwing `fetch` stub.
- [ ] 12.2 `lib/talk-path.ts`, `containers/PresenterKeys`, `PathNav`, `content/copy.ts`, static screens, `/demo-2` and `/demo-3` placeholders.

## P13 web-landing (`feature/web-landing`)

- [ ] 13.1 Tests: hero, manifesto, cards, tagline, FAQ, "Built on Avalanche" text link, one-column rule under 768px.
- [ ] 13.2 D22 organisms and `LandingTemplate`; copy in `copy.ts`.

## P14 web-identity (`feature/web-identity`)

- [ ] 14.1 `demos/01-x402-twin/identity-card.ts` (`readDemo1Identities`) plus tests: live, fork down labeled "offline" with last-known ids.
- [ ] 14.2 Identity card organism and page wiring.

## P15 web-wallet (`feature/web-wallet`)

- [ ] 15.1 Tests in `packages/chains`: `txUrl` fuji, undefined for `cchain` and bad hash, `ChainError` unknown key; subpath exports only registry and `txUrl`, no `node:` import; root and registry JSON unchanged.
- [ ] 15.2 `src/explorer.ts`, `src/browser.ts`, `package.json` export `./registry`.
- [ ] 15.3 `containers/wallet-provider.tsx`; test config `[43113]`, injected only.

## P16 web-first-tx (`feature/web-first-tx`)

- [ ] 16.1 Tests: `buildFirstTx` self-transfer of `10n ** 15n`; `firstTxState` (happy, rejected, no balance, mainnet, switch rejected, no wallet); no link before a hash.
- [ ] 16.2 Test (added): pre-sent unset shows "not set yet" and no anchor (`specs/first-fuji-tx/spec.md:86-90`); set renders a `txUrl` link in every state. Hash lands after rehearsal.
- [ ] 16.3 `lib/first-tx.ts`, `lib/first-tx-state.ts`, `app/path/first-tx/page.tsx` in `WalletProvider`.

## PLAN Done-when map

- T10.1: tokens read by web and docs -> 8.2, 8.3; atoms props only -> 9.1; logos only after O4 -> 9.3 (stays true).
- T10.2: no hooks or ports in presentational files -> 2.1, 2.2; secrets stay out -> 2.3; builds in CI -> 2.4.
- T10.3: routes match section 7 -> 12.1, 12.2; keyboard -> 12.1, 12.2; copy follows O14 -> 12.2, 13.2.
- T10.4: explorer URL from chains -> 15.2, 16.1; pre-sent fallback -> 16.2; wrong network -> 16.1.
- T10.5: one schema and UI -> 3.1, 11.2; dropped stream resumes -> 4.1, 7.2; "replays labeled on screen" stays OPEN until `/demo-2` (T10.7).
- T10.6: timeline beside strip -> 11.1; quote source and "market rate, not official" -> 10.1, 11.1; balances and hashes without links -> 11.1.
