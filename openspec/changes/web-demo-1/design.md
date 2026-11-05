# Design: Web app through Demo 1 (M10, T10.1 to T10.6)

## Technical Approach

`apps/web` (`@hackatwin/web`) is a Next 16 App Router app. Its server side is a composition root (PLAN § 1.3): route
handlers call Demo 1's run entry, exported through `@hackatwin/demo-01-x402-twin/module`, and stream unchanged
`AgentEvent`s in a `{ seq, source, event }` envelope over SSE from an in-memory run store. The browser receives
serialized data only. wagmi knows Fuji alone. `packages/ui` holds the CSS-variable tokens and props-only atoms that
the docs theme also reads. Requirements: `specs/*/spec.md` in this change.

## Architecture Decisions

| # | Topic | Choice | Rejected | Why |
|---|---|---|---|---|
| D1 | Versions | Catalog adds `next 16.4.3`, `wagmi 3.7.9`, `@tanstack/react-query 5.104.5`, `server-only 0.0.1`, `@types/react 19.3.0`, `@types/react-dom 19.3.0`. `apps/web` pins `typescript 5.9.3` literally, like `apps/docs` | TS 7.0.2 in web | Next type checks through the TypeScript JS API; peers match react 19.3.1 and viem 2.57.16 |
| D2 | Bundling | `transpilePackages` lists every `@hackatwin/*` the app imports; `turbopack.root` and `outputFileTracingRoot` are the repo root; tsconfig extends the base with `module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, DOM libs | Building packages to `dist` | Packages ship `.ts` source with `.ts` specifiers and JSON import attributes |
| D3 | Layout | `src/app` routes only; `src/server` composition root, store, SSE, handlers, replay (each file imports `server-only`); `src/containers` client files (hooks, wagmi, EventSource); `src/components/{molecules,organisms,templates}` presentational; `src/lib` pure browser-safe logic; `src/content/copy.ts` all copy. Tokens and atoms in `packages/ui/src` | Atoms inside the app | `packages/ui` has two consumers (PLAN § 2) |
| D4 | Lint rule | R10, R11 and the R2 exception go into `test/dependency-rule.ts` with the spec detection definitions (see Dependency rule below) | Biome `noRestrictedImports` | Biome cannot detect the `"use client"` directive; R1 to R9 already live there |
| D5 | Lazy root | `server/root.ts` only defines functions; each POST composes the profile, keystores and guarded fork inside the run entry; routes set `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` | A memoized shared root | Re-checks keys and the fork guard after a fork restart; scrypt N=8192 keeps it cheap; build reads no env |
| D6 | Per-run scope | The run entry resolves the buyer in `root.container.child()` with the run's event sink, disposed after the run | Events at the root | Events, policy and buyer cache in the child; the module stays the CLI's |
| D7 | Cycle | Package export `./module` points to a new barrel `index.ts`; `module.ts` keeps only `registerX402Module`; `root.ts` imports `module.ts`; `buyer-agent/entry.ts` imports `root.ts` | Moving the module body to a new file | No cycle and no rewritten file (a move costs about 370 diff lines) |
| D8 | Keystore dir | `STATE_DIR` moves to `state-dir.ts`, imported only by CLI entries, which pass `composeRoot({ stateDir })`; the root uses `KEYSTORE_DIR ?? stateDir` and otherwise fails naming `KEYSTORE_DIR`; a relative `KEYSTORE_DIR` fails the existing absolute-path schema with a `ConfigError` naming it; web `dev` and `start` run Next under `node --env-file-if-exists=../../.demo1/demo1.env --env-file-if-exists=../../.env` | `import.meta.dirname` in bundled code | Bundlers may leave it undefined, and `resolve(undefined)` throws at import during `next build` |
| D9 | Store | One store on `globalThis[Symbol.for('hackatwin.web.runs')]`: one active run, slot reserved synchronously before preflight, envelope buffer of the latest run, synthetic `run.finished` `error` when the run throws or ends without one; balances `before`/`after` on the record | Per-request runs; a database | Survives dev reloads; a second POST gets 409 with the active id |
| D10 | SSE | `GET /api/runs/[id]/events`: `id: seq`, `data: frame`; frames with `seq > Last-Event-ID`, then live; close after `run.finished`; `retry: 1000`; `: ping` every 15 s; `no-cache, no-transform`, `X-Accel-Buffering: no`; abort only unsubscribes | WebSocket; polling | EventSource resends `Last-Event-ID` by itself; a disconnect never cancels a payment |
| D11 | Redaction | Error text leaving the server (POST bodies, `run.finished.message`) has URLs and absolute paths replaced | Raw messages | viem errors can carry the fork RPC URL |
| D12 | Explorer | `packages/chains/src/explorer.ts` `txUrl(key, hash)`: `undefined` unless `hash` matches `/^0x[0-9a-fA-F]{64}$/` and the chain is live `read-write` with a viem explorer (`toViemChain(key).blockExplorers.default.url` + `/tx/<hash>`); an unknown key throws the registry's `ChainError`. Subpath `@hackatwin/chains/registry` → `src/browser.ts` exports only the registry and `txUrl`; the root index is unchanged, so server code also imports `txUrl` from the subpath | Explorer field in the JSON | Registry JSON stays untouched |
| D13 | Tokens and atoms | `packages/ui/src/tokens.css` is the only palette file: `--hk-bg #141210`, `--hk-fg #f2ead8` (about 15:1), `--hk-accent #e8804a` (about 6.8:1), `--hk-accent-ink` for light docs surfaces, monospace-first system stacks, spacing, radius, motion. `atoms.css` (`hk-` classes) gives Button and the TxLink anchor a `:focus-visible` outline and declares the Cursor blink only inside `@media (prefers-reduced-motion: no-preference)`; organisms use CSS Modules; docs `customCss` adds the tokens through `createRequire(import.meta.url).resolve('@hackatwin/ui/tokens.css')` and maps Infima variables | Tailwind; webfonts | No new dependency; no network at build |
| D14 | Routes | One `TALK_PATH` in `lib/talk-path.ts` with the nine § 7 paths; folders `app/path/{avalanche,first-tx,identity,production,built-by-agents}` and `app/demo-{1,2,3}`; `/demo-2`, `/demo-3` labeled placeholders | Dynamic `[screen]` | Screens differ; static ones prerender |
| D15 | Keys | `PresenterKeys` container in the root layout over a pure `nextPath(path, key)`: ArrowRight/PageDown, ArrowLeft/PageUp, Home, no wrap; ignored with modifiers, `defaultPrevented`, or focus in input, textarea, select, contenteditable. `PathNav` shows `n / 9` with `rel` links | Hotkey library | Clickers send PageUp and PageDown |
| D16 | Wallet and first tx | `WalletProvider` scoped to `/path/first-tx`: `createConfig({ chains: [toViemChain('fuji')], connectors: [injected()], transports: { 43113: http(fuji rpc.public) }, ssr: true })`. `lib/first-tx.ts` builds `{ to: account, value: 10n ** 15n }` (0.001 AVAX to itself); the injected wallet signs and sends it; no server route or server-held key exists for it. Pure `firstTxState()` maps wagmi status to the spec states | App-wide provider; WalletConnect | Keeps wagmi off other routes |
| D17 | Demo 1 data | Quote, strip and timeline come only from frames through `lib/demo-1-state.ts` (seq-deduped, money via `formatMoney`); `GET /api/runs/[id]` returns status, `llm`, balances as decimal strings; the page passes the latest run id and Claude availability (`loadProfile('cchain-fork', undefined, { llm: 'claude' })`) as props | Pre-run quote read | Spec: the panel is fed by `payment.required` only |
| D18 | Identity | Module exports `readDemo1Identities()`: ids from state, `ownerOf`, `reputation` (undefined when unreadable); the page falls back to committed last-known ids labeled "offline" | Client-side reads | Fork clients stay server side |
| D19 | CI | `changes` gets a `web` filter (root manifests, `apps/web/**`, `packages/**`, `demos/01-*/**`) and `docs` gets `packages/ui/**`; job `web-build`: install, `pnpm --filter @hackatwin/web build` with sentinel env values, `node apps/web/scripts/scan-static.ts`, `NEXT_TELEMETRY_DISABLED=1`; added to `ci-gate` needs | A separate workflow | ADR 0002, one gate |
| D20 | Services | The web never spawns a process. Root scripts `web` and `web:demo1` (`pnpm run "/^(demo1:facilitator|demo1:seller|web)$/"`, parallel); fork, fund and register stay T-60 steps | A web-side starter | Proposal assumption 3 |
| D21 | Start control | `containers/demo-1-run.tsx` over pure `lib/starter.ts`: presses while a POST is pending or a run is active are ignored (one POST per double click); Claude is disabled with the copy reason "the server has no ANTHROPIC_API_KEY"; Scripted is labeled on the control and as a badge from `run.started.llm`; an EventSource error before `run.finished` shows "Reconnecting" and resumes by `Last-Event-ID`; a `decodeFrame` failure closes the stream and shows an error state; POST errors show the returned command text; no replay control | Client retries by POST | Only a press may pay |
| D22 | Landing and marks | Organisms `Hero` (Cursor `> HACKATWIN_`), `Manifesto`, `SplitCards` (Twin and team1 as text marks), `TaglineBand`, `Faq` (`details`/`summary`, no hooks), molecule `BuiltOnAvalanche` (plain text link, URL in copy); `LandingTemplate` grid collapses to one column under `@media (max-width: 767px)`. No logo image or SVG until O4 | Logo assets | O4 is open |
| D23 | Copy | `content/copy.ts` holds every user-facing string, English (O14); pages pass copy slices as props. Static screens (`/path/avalanche`, `/path/production`, `/path/built-by-agents`) are synchronous server components with no fetch | Inline strings | One place to translate if O14 changes |
| D24 | Replay | `server/replay-source.ts` reads JSONL and emits `source: 'replay'` frames; a bad line ends the replay with a `run.finished` `error` frame whose message names the line number, shown by the timeline | Skipping bad lines | Spec: visible error |

## Data Flow

    browser                         Next server (nodejs)                  Demo 1 (via module)
    Start ──POST /api/runs {llm}──→ handlers.start ──reserve slot──→ store
                                     └─ startDemo1Run(llm) ──→ composeRoot → preflight → before
                                                                child() → runBuyer → AgentEvent*
    EventSource ←── SSE frames ──── store buffer {seq, source, event} ←────────┘
    (Last-Event-ID on reconnect)    run.finished → after() balances on the record

## Interfaces / Contracts

```ts
// apps/web/src/lib/envelope.ts: wire event is the encodeAgentEvent string, per spec
export type Source = 'live' | 'replay';
export interface Envelope { readonly seq: number; readonly source: Source; readonly event: AgentEvent }
export function encodeFrame(e: Envelope): string;
export function decodeFrame(data: string): Envelope;

// apps/web/src/server/run-store.ts
export interface StartedRun {
  readonly llm: 'claude' | 'scripted';
  readonly before: BalanceSnapshot;
  readonly events: AsyncIterable<AgentEvent>;
  after(): Promise<BalanceSnapshot>;
}
export interface RunStore {
  start(open: () => Promise<StartedRun>): Promise<{ readonly id: string } | { readonly conflict: string }>;
  latest(): RunView | undefined;
  get(id: string): RunView | undefined;
  subscribe(id: string, afterSeq: number, onFrame: (e: Envelope) => void): (() => void) | undefined;
}

// demos/01-x402-twin/buyer-agent/entry.ts, re-exported by index.ts
export interface Demo1RunOptions {
  readonly llm: 'claude' | 'scripted';
  readonly stateDir?: string;
  readonly urls?: X402ModuleConfig;
  readonly channel?: EventChannel;
  readonly preflight?: Partial<PreflightDeps>;
  readonly compose?: (options: RootOptions) => Promise<Root>;
}
export function startDemo1Run(options: Demo1RunOptions): Promise<Demo1Run>;

// packages/chains/src/explorer.ts, exported only through @hackatwin/chains/registry
export function txUrl(key: string, hash: string): string | undefined;
```

HTTP: `POST /api/runs` → 202 `{id}`, 409 `{id}`, 400 bad body, 422 missing key (names `ANTHROPIC_API_KEY`), 503
preflight or other config error (names the `pnpm demo1:*` command or the variable, for example `KEYSTORE_DIR`);
`GET /api/runs/[id]` → 200 or 404; events route → SSE or 404. Next 16 passes `params` as a Promise. Handlers are
factories (`createStartHandler(deps)`) so tests inject fakes.

Dependency rule (spec wording):

- R2: the `apps/web` manifest may depend on `@hackatwin/demo-*`. Only files under `apps/web/src/server/**` that import
  `server-only` may import `@hackatwin/demo-*/module`, and only that entry. Any other `apps/web` file that imports a
  demo, even through `module`, fails R2, as do deep and relative demo imports.
- R10: presentational files (any file under `apps/web/src/components/**` or `packages/ui/src/**`, test files exempt)
  import no `react` hook, no `wagmi`, no `@tanstack/react-query`, and no `@hackatwin/core`.
- R11: client files (first statement `"use client"`, test files exempt) import no demo package, no `@hackatwin/config`,
  no `@hackatwin/chains` root (only `@hackatwin/chains/registry`), no `@hackatwin/chains/keystore`, no
  `@hackatwin/agent-kit`, no `@hackatwin/pricing`, no `server-only`, and nothing from `apps/web/src/server`.

## File Changes

| PR | Files (all under the repo root) |
|---|---|
| 1 scaffold | Create `apps/web/{next.config.ts,src/app/layout.tsx,src/app/page.tsx,src/server/root.ts,scripts/scan-static.ts}`, `test/stubs/server-only.ts`; modify `apps/web/{package.json,tsconfig.json}`, `pnpm-workspace.yaml`, `vitest.config.ts` (`server-only` alias, automatic JSX), `test/dependency-rule.ts`, `.github/workflows/ci.yml`, root `package.json`; delete `apps/web/src/index.ts` |
| 2 stream | Create `apps/web/src/lib/envelope.ts`, `apps/web/src/server/{run-store,sse,handlers,replay-source,redact}.ts`, `apps/web/test/fixtures/{replay,replay-bad-line}.jsonl` |
| 3a run entry | Create `demos/01-x402-twin/{index.ts,state-dir.ts,buyer-agent/entry.ts}`; modify `module.ts`, `root.ts`, `state.ts`, `package.json`, `buyer-agent/main.ts`, `scripts/{fork,fund,register}.ts`, `facilitator/main.ts`, `seller-api/main.ts` |
| 3b live (checkpoint) | Create `docs/adr/0012-web-imports-demo-modules.md`, `apps/web/src/app/api/runs/{route.ts,[id]/route.ts,[id]/events/route.ts}`, `apps/web/src/app/demo-1/page.tsx`, `apps/web/src/containers/demo-1-run.tsx`, `apps/web/src/lib/starter.ts`; modify `docs/adr/README.md`, `test/dependency-rule.ts`, `apps/web/package.json`, root `package.json`, `docs/demos.md` |
| 4 tokens | Create `packages/ui/src/{tokens.css,atoms.css,atoms/*.tsx}`, `apps/web/test/assets.test.ts`; modify `packages/ui/{package.json,src/index.ts}`, `apps/docs/{package.json,docusaurus.config.ts,src/css/custom.css}`, `.github/workflows/ci.yml`, web layout |
| 5 to 10 | Demo 1 screen (`lib/demo-1-state.ts`, organisms), guided path (`lib/talk-path.ts`, `content/copy.ts`, static screens, placeholders), landing (D22 organisms, `LandingTemplate`), identity (`demos/01-x402-twin/identity-card.ts`), wallet (`packages/chains/{package.json,src/explorer.ts,src/browser.ts}`, `containers/wallet-provider.tsx`), first tx (`lib/first-tx.ts`, `lib/first-tx-state.ts`) |

PR 3 splits into 3a and 3b to stay under 400 lines; the checkpoint moves to 3b.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Rule | R2 exception (server file passes; non-server, no-`server-only`, client, deep and relative imports fail), R10, R11 (chains root, agent-kit, pricing fail; `chains/registry` passes) | In-memory snapshots in `test/dependency-rule.test.ts` |
| Unit | Envelope round trip, `version: 2` error, store (409, reservation, seq without gaps, throw, globalThis reload) | Vitest, fake `StartedRun` |
| Route | 202/409/422/503, SSE headers, `Last-Event-ID: 4` → 5..7, 404, abort, redaction; the `app/api` route list equals the three run routes (no Fuji route, no server-held key) | Handler factories, `new Request`, read the body stream; file listing |
| Replay | Fixture frames all `source: replay` with the "Replay" label; the bad-line fixture ends with a `run.finished` `error` naming line 3, rendered visibly | Replay source plus `renderToStaticMarkup` |
| Demo | CLI parity, `PreflightError` before writes, Claude key before chain calls, relative `KEYSTORE_DIR` fails naming the variable | Injected `compose` and preflight deps |
| Controls | `starter` sends one POST for two presses; Claude disabled with its reason; Scripted badge; reducer reaches "Reconnecting" and decode-error states, both rendered | Pure functions plus component markup |
| Component | Atoms and organisms per spec scenarios (no `<a>` for fork hashes, guard text, empty quote, no replay control); landing landmarks hero, manifesto, cards, tagline, FAQ, link | `renderToStaticMarkup`, node env |
| CSS | Tokens contrast at least 4.5:1, no palette literal outside `tokens.css`, `:focus-visible` on Button and TxLink, Cursor animation only under `no-preference`, landing one-column rule under 768px | CSS file reads |
| Copy | No literal user-facing text or `aria-label`/`title`/`alt` strings in `components/**` and `packages/ui/src/**`; static screens render with a `fetch` stub that throws and is never called | Source scan; render with stubbed `fetch` |
| Marks | No image or SVG file named like Twin, team1, Avalanche or AVAX under `apps/web/{public,src}`, `packages/ui/src`, `apps/docs/{static,src}`; the "Built on Avalanche" text link renders | `assets.test.ts` file listing; markup |
| Static | `TALK_PATH` equals PLAN § 7, a page file per path, wagmi config (`[43113]`, injected only), `buildFirstTx` is a self-transfer of `10n ** 15n`, `firstTxState` | Pure functions and file reads |
| Chains | `txUrl` for `fuji`, `undefined` for `cchain` and a malformed hash, `ChainError` for an unknown key; the registry subpath exports only the registry and `txUrl` and its graph has no `node:` import; root index exports unchanged | Vitest in `packages/chains` |
| Build | No sentinel, `ANTHROPIC_API_KEY`, `KEYSTORE` or `anvil_` in `.next/static`; a planted sentinel fails; CI sentinels match the script | `scan-static.test.ts` plus the CI job |

Playwright stays in T10.10.

## Threat Matrix

N/A: no shell command composition, git selection, commit, push, PR automation, or file classification. The web
server spawns nothing. Secret and fork-guard boundaries are covered by R11, D11 and the static scan.

## Migration / Rollout

One linear merge queue: PR 1 branches from the contracts stack tip at apply time (not `feature/e2e-demo-1`), each next
PR from the previous one, so `ci.yml` merges in order. One squash commit per PR; revert newest first. Fork state is
disposable.

## ADR 0012 draft

Title: the web server imports demo modules through `module` only. Context: PLAN § 1.3 makes the web server a root that
wires demo modules; R2 forbids it. Decision: the `apps/web` manifest may depend on `@hackatwin/demo-*`; only files under
`apps/web/src/server/**` that import `server-only` may import `@hackatwin/demo-*/module`; every other `apps/web` file
fails R2, and client files also fail R11. Each demo's `module` export is its barrel (registration plus one run entry),
and the web calls the run entry per run. Rejected: copying Demo 1 composition into the web (two roots drift, keystore
and guard logic duplicated); spawning `pnpm demo1` and parsing stdout (second schema, process management).
Consequences: demo internals stay private; other apps and packages keep R2.

## Spec Notes

Two acknowledged deviations, already reflected in the specs:

| Spec point | Design reading |
|---|---|
| `web-build` path filter | Root manifests, `apps/web/**`, `packages/**`, `demos/01-*/**`; a docs-only change still skips it |
| Every route answers 200 | A page-file test per path plus the CI build; HTTP 200 checks land with T10.10 |

## Open Questions

- [ ] O13: may the scripted run be used on stage? The UI labels it either way.
- [ ] Pre-sent Fuji hash and last-known identity ids land after rehearsal; until then the UI says "not set yet".
- [ ] PR 1 spike: Turbopack with `.ts` specifiers and JSON import attributes (fallback `next build --webpack`), and
      `next typegen && tsc --noEmit` for typecheck without a build (fallback: commit `next-env.d.ts`).
