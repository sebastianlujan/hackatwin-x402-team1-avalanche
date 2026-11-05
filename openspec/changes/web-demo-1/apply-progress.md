# Apply progress: web-demo-1

## Batch 1 (P1 to P7), mode Standard, stacked PRs to `develop`

Queue base: PR #174 (`feature/constructor-zero-checks`). Authored lines exclude `pnpm-lock.yaml`, counted against the previous PR.

| PR | Branch | Issue | Lines | Tasks |
|---|---|---|---|---|
| P1 #176 | `feature/web-scaffold` | #175 | 102 | 1.1 to 1.7 |
| P2 #178 | `feature/web-guardrails` | #177 | 172 | 2.1 to 2.4 (2.5 open) |
| P3 #180 | `feature/web-event-stream` | #179 | 397 | 3.1 to 3.3 |
| P4 #182 | `feature/web-event-stream-http` | #181 | 362 | 4.1 to 4.3 |
| P5 #184 | `feature/demo-1-run-entry` | #183 | 398 | 5.1 to 5.3 |
| P6 #186 | `feature/web-live-api` | #185 | 165 | 6.1 to 6.4 |
| P7 #188 | `feature/web-live-page` | #187 | 399 | 7.1 to 7.6 |

## Batch 2 (P8 to P11), mode Standard, stacked PRs to `develop`

Queue continues from P7 (`feature/web-live-page`, #188). P11 measured 548 authored lines, so it ships as four PRs at named seams.

| PR | Branch | Issue | Lines | Tasks |
|---|---|---|---|---|
| P8 #190 | `feature/ui-tokens` | #189 | 177 | 8.1 to 8.3 |
| P9 #192 | `feature/ui-atoms` | #191 | 267 | 9.1 to 9.3 |
| P10 #194 | `feature/web-demo-1-state` | #193 | 357 | 10.1 |
| P11a #196 | `feature/web-demo-1-organisms` | #195 | 247 | 11.1 (timeline, strip) |
| P11b #198 | `feature/web-demo-1-panels` | #197 | 312 | 11.1 (quote, balances, fork hashes) |
| P11c #200 | `feature/web-demo-1-screen` | #199 | 272 | 11.1 (template, start control) |
| P11d #202 | `feature/web-demo-1` | #201 | 172 | 11.2 and checkpoint |

Checkpoint (11.2, rerun of 7.6): local anvil fork, scripted run over SSE (15 frames), and a real headless Chrome rendered `/demo-1` with strip, timeline, quote ("market rate, not official"), balances and fork hashes without links. Evidence is in the P11d PR body.

## Batch 2 deviations

- `content/copy.ts` is created in P11a (not P12) because the organisms take copy as props; P12 extends it.
- Timeline also lists the payment steps (`payment.required`, `payment.signed`, `resource.received`) so the "happy order" scenario holds; policy and finish reasons are there too.
- `lib/run-record.ts` (not in the design) parses `GET /api/runs/[id]` for balances.
- Balances row headers needed `white-space: nowrap` (found in the checkpoint screenshot), fixed in P11d.
- The fork CI job flaked twice on upstream RPC timeouts in `register.fork.test.ts` (unrelated); failed jobs were rerun once.

## Spike outcomes

- 1.1: Turbopack builds `.ts` specifiers and JSON import attributes (verified with a page importing `@hackatwin/chains`); no `--webpack` fallback.
- 1.2: `next typegen && tsc --noEmit` works from a clean tree; `next-env.d.ts` is generated and git-ignored.
- 1.3: `sharp` has no install script; `allowBuilds: sharp: false` recorded. No minimum-release-age or exotic-subdep exclusion was needed for any pin.

## Deviations from the design

- D8: Next copies Node flags into `NODE_OPTIONS`, which rejects `--env-file-if-exists`, so `dev` and `start` cannot use it. `next.config.ts` loads `.env` then `.demo1/demo1.env` with `process.loadEnvFile` outside the production build (shell wins). `dev` and `start` also bind 127.0.0.1.
- D19 and the static scan spec conflict with the 7.1 copy: the UI must say "the server has no ANTHROPIC_API_KEY", but the scan forbids `ANTHROPIC_API_KEY` in `.next/static`. The scan now strips that exact phrase before matching; a test pins it to the starter constant.
- 2.4: the `docs` filter entry for `packages/ui/**` stays with 8.3.
- `apps/web` sets `agentRules: false` so Next does not write `AGENTS.md`.
- 3.3: the store keeps the slot `starting` until preflight resolves; a failed open rethrows and creates no run.
- 7.4: `pnpm run "/regex/"` already runs matched scripts in parallel; `--parallel` is rejected by pnpm 12 for this form.
- 7.6: driven with curl, not a real browser (no browser in this environment). Evidence is in the P7 PR body.

## Open

- 2.5 acceptance (failing build fails the gate, docs-only skips `web-build`) is true by construction of the `changes` filter and `ci-gate` needs; no experiment was run.
- 2.5 stays open by design (no experiment run).

## Batch 3 (P11e, P12 to P16)

Stacked on `feature/web-demo-1`, one linear queue, all PRs target `develop`. Authored lines exclude `pnpm-lock.yaml`.

| Unit | Branch | PR (issue) | Lines | Tasks |
|---|---|---|---|---|
| P11e | feature/web-demo-1-format | #204 (#203) | 270 | formatter, decision copy, balance layout (review of the batch 2 screenshot) |
| P12a | feature/web-guided-path | #206 (#205) | 256 | 12.1, 12.2 keys and order |
| P12b | feature/web-guided-path-screens | #208 (#207) | 271 | 12.1, 12.2 static screens, placeholders, copy scan |
| P13 | feature/web-landing | #210 (#209) | 344 | 13.1, 13.2 |
| P14a | feature/demo-1-identity-reader | #212 (#211) | 148 | 14.1 |
| P14b | feature/web-identity | #214 (#213) | 312 | 14.2 |
| P15 | feature/web-wallet | #216 (#215) | 133 | 15.1, 15.2, 15.3 |
| P16a | feature/web-first-tx-state | #218 (#217) | 167 | 16.1 (logic), 16.2 data |
| P16b | feature/web-first-tx | #220 (#219) | 293 + 12 | 16.2, 16.3 |

## Batch 3 deviations

- P11e: amounts use `lib/format.ts` (two decimals from one unit up, two to four below, thousands separators, USD as `$0.01`, rate as `1 USD = 1658.4 ARGt`); full precision stays in `title`. The Demo 1 grid stacks under 1024px because the side column overflowed at exactly 768px.
- P12: `/path/identity` and `/path/first-tx` were labeled placeholders in P12b until P14b and P16b replaced them. The `TALK_PATH` test parses the Screen column of `docs/PLAN.md`.
- P14: the registry read is `readDemo1Identities` plus injected `readIdentityCard`; any read failure (including an unregistered role) shows the committed last-known ids as "offline"; `content/last-known.ts` is empty until rehearsal ("not set yet"). Verified on a local fork: live ids 1850 and 1851 with the keystore owners, rejection with the fork stopped.
- P15: `createWalletConfig` casts the registry chain to the web app's `viem` `Chain` (two viem installs because the web pins TypeScript 5.9.3).
- P16: wagmi 3 renamed `useAccount` to `useConnection`; the container uses `useConnection`, `useConnectors` and the `mutate` forms. The pre-sent hash (`content/pre-sent.ts`) is unset until rehearsal. A follow-up commit in P16b aligns the talk screens and the path nav to the page grid (found in the final screenshots).
- Screenshots (headless Chrome, local): demo1-v2.png, landing.png, path.png, first-tx.png under the session scratchpad.

## Open

- 2.5 acceptance (no experiment run); pre-sent Fuji hash and last-known identity ids after rehearsal; O4 logos; O13.

## Batch 4: verify fixes

PR #222 (`feature/web-verify-fixes`, issue #221, 67 authored lines). Closes verify W2, W3, S1, S2, S3, S6.
- Copy: Twin card, FAQ authorship and `demo1.lead` corrected; `copy.test.ts` pins them.
- `POST /api/runs` guard: `Origin`, when present, must equal the request's own origin (Host header); otherwise 403. Content-type must be `application/json`, otherwise 415. No `Origin` (curl) is allowed. Agent-event-stream behavior: GET `/api/runs/[id]` and `/events` are unchanged (read-only); only run start is guarded.
- `hackatwin-sentinel-fork` added to `SENTINELS` and to the CI `web-build` env as `CCHAIN_FORK_RPC_URL`.
- `docs/demos.md` web URL is now `http://127.0.0.1:3000/demo-1`, with the route guard noted.
- Local fork evidence: JSON POST 202, Origin evil.example 403, no content-type 415, same-origin 202; ports freed.
