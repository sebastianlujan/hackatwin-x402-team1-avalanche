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
- Next batch: P8 onward.
