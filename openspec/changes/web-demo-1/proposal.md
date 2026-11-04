# Proposal: Web app through Demo 1 (M10, T10.1 to T10.6)

## Intent

Demo 1 runs only in a terminal, and `apps/web`, which drives the talk (PLAN § 7), is empty. First checkpoint: run
`pnpm --filter web dev`, start a scripted Demo 1 run on the local fork from `/demo-1`, and watch the live
`AgentEvent` stream. After that: the full Demo 1 screen, the guided path, the identity card, and the first Fuji
transaction.

## Scope

### In Scope

- T10.1 to T10.6, every Done-when box.
- R2 exception: `apps/web` server files may import `@hackatwin/demo-*/module`, and only that entry. PLAN § 1.3 wires
  modules in the web root, but R2 forbids that today.
- The Demo 1 run entry (compose, preflight, run, balances) is exported through `module`, and the CLI reuses it.
- An explorer URL helper in `packages/chains`.

### Out of Scope

- T10.7 to T10.10, deploys (O9), logos (O4), any Demo 1 recording (Q2), and starting anvil from the web server.
- Changes to `AgentEvent`. The SSE envelope adds only `seq` and `source`.

## Capabilities

### New Capabilities

- `web-shell`: T10.2.
- `agent-event-stream`: T10.5.
- `design-tokens`: T10.1.
- `demo-1-screens`: T10.6.
- `guided-path`: T10.3.
- `first-fuji-tx`: T10.4.

### Modified Capabilities

- `workspace-dependency-rule`: the R2 web exception; new R10, presentational components import no hooks or ports;
  client files never import config, the keystore, demos, or server code.
- `demo-1-buyer`: the run entry is exported through `module`.
- `chain-registry`: a tx explorer URL for `read-write` chains only, and a browser-safe entry point.
- `ci-workspace-jobs`: a `web-build` job in `ci-gate`.
- `docs-site`: the docs theme reads the shared tokens.

## Approach and PR slicing

The stack starts from `feature/e2e-demo-1` (#106). Every PR targets `develop`, stays at or under 400 authored lines,
and needs no `size:exception`. The checkpoint lands at PR 3, so the tokens move after it and the scaffold uses plain
markup until PR 4. Tests use Vitest: `react-dom/server` markup for components, pure reducers, and route handlers with
fake sources injected through DI. Strict TDD order is not required for TypeScript (Q21).

| PR | Branch | Approach | Est. |
|---|---|---|---|
| 1 | `feature/web-scaffold` | App Router; lazy `server-only` root, so the build needs no env; R10; client-import rule; `.next/static` secret scan; CI build | 360 |
| 2 | `feature/web-event-stream` | Run store with one live run and a `seq` buffer; SSE that resumes from `Last-Event-ID`; labeled JSONL replay source | 350 |
| 3 | `feature/web-demo-1-live` | R2 delta and ADR; run entry in a child container per run; POST start; dev script loads `.demo1/demo1.env`; bare timeline. **Checkpoint** | 320 |
| 4 | `feature/ui-tokens` | CSS variables; props-only atoms (TxLink renders a plain hash when it has no URL); text marks; docs theme | 300 |
| 5 | `feature/web-demo-1` | Timeline next to the 402 → pay → 200 strip; quote panel (source, guard flag, "market rate, not official"); balances; fork hashes without links | 390 |
| 6 | `feature/web-guided-path` | § 7 routes, presenter keys, static screens, copy in one module | 350 |
| 7 | `feature/web-landing` | Hero with `> HACKATWIN_`, manifesto, split cards, tagline band, FAQ, "Built on Avalanche" link | 300 |
| 8 | `feature/web-identity` | ERC-8004 card read from the fork, with a labeled fallback | 250 |
| 9 | `feature/web-wallet` | The T10.2 wagmi provider (Fuji only, injected wallets) and the explorer helper | 280 |
| 10 | `feature/web-first-tx` | Send, explorer link, pre-sent fallback, wrong-network states | 300 |

## Affected Areas

| Area | Impact |
|---|---|
| `apps/web/`, `packages/ui/` | New |
| `demos/01-x402-twin/`, `packages/chains/src/`, `test/dependency-rule.ts` | Modified |
| `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `apps/docs/`, `docs/adr/`, `docs/demos.md` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `next`, `wagmi`, `@tanstack/react-query`, `server-only`, and `@types/react` are unpinned; compatibility with react 19.3.1 and viem 2.57.16 is unverified | High | PRs 1 and 9 add exact catalog pins checked against peer ranges |
| TypeScript 7.0.2 may lack the JS API that Next uses | Med | Pin 5.9.3 in `apps/web`, as `apps/docs` does |
| Next may not bundle the source-only `.ts` workspaces (`.ts` specifiers, JSON import attributes, `import.meta.dirname`) | Med | Spike in PR 1; require an absolute `KEYSTORE_DIR` |
| SSE buffering, aborted requests, or dev reloads lose runs | Med | `nodejs` runtime, `force-dynamic`, `no-transform`, heartbeats, store kept on `globalThis` |
| A reconnect or a double click pays twice | Med | Start only by POST, one active run, resume from the buffer |
| The fork guard (ADR 0007) or secrets reach the browser | Low | Guarded clients and secrets stay in the server root; wagmi knows only Fuji; `fork-only` chains get no links; CI scan |
| Conflicts with the contracts branches | Med | Registry JSON stays untouched (explorer URL from viem chain data); take the next free ADR number |

## Rollback Plan

One squash commit per PR; revert the newest first. `apps/web` and `packages/ui` are additive. Reverting PR 3 restores
R2 and `module`; reverting PR 4 restores the docs theme. Fork state is disposable.

## Dependencies

- #106, and the Demo 1 services from `docs/demos.md` running.
- Decisions: Q1, Q2, Q5, Q12, Q16, Q17, Q20, C1, C3; ADR 0005, 0007, 0008.
- O4: text marks until approved. O14: English in one copy module; it gates only the final copy of PRs 6 and 7. O13:
  whether the scripted run may be used on stage.

## Success Criteria

- [ ] `pnpm --filter web dev` streams a scripted run on `/demo-1`, and a reload resumes it without a second payment.
- [ ] The presenter moves through the § 7 routes with the keyboard.
- [ ] A Fuji transaction opens on the explorer, and a wallet on the wrong network cannot send.
- [ ] `.next/static` contains no secret, R1 to R10 pass, and CI builds the app.

## Proposal question round (pending review, auto mode)

1. LLM on `/demo-1`: assumed Claude when the server has the key, plus a labeled scripted run. Should the scripted run
   stay hidden on stage until O13 is answered?
2. Replay (Q2): assumed no Demo 1 replay anywhere in the UI, so the replay label first appears on screen with
   `/demo-2`. Is that acceptable for T10.5?
3. Services: assumed the web attaches to the services started at T-60 and shows the failing preflight command; it
   never starts anvil. Do you want a dev-only starter?
4. First transaction: assumed a 0.001 AVAX self-transfer from an injected wallet, with no WalletConnect; the fallback
   hash is committed after the rehearsal.
5. Identity: assumed the card shows the Demo 1 agent and seller on the fork; the fallback shows the last-known IDs,
   labeled offline.
