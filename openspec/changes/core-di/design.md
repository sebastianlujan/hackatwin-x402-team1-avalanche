# Design: Core DI, ports, and config profiles (M3)

## Technical Approach

Fourteen source-only TypeScript workspaces join the pnpm workspace. `@hackatwin/core` (zero dependencies) holds the
container, domain types, seven ports, and fakes under `./testing`. `@hackatwin/config` (core plus zod) holds the four
profiles and the only `process.env` reader ([ADR 0005](../../../docs/adr/0005-config-package-outside-core.md)). One
root Vitest run covers unit tests and the dependency-rule test; CI adds `typecheck` and `test` behind a `ts` filter.
Specs: `specs/{workspace-dependency-rule,di-container,core-domain-ports,config-profiles}/spec.md`.

## Architecture Decisions

| Area | Choice | Rejected | Why |
|---|---|---|---|
| Config home | `packages/config` (ADR 0005) | zod in core; hand-rolled validation | Core stays dependency-free |
| Packaging | Source-only: `exports` point at `.ts`; `tsc --noEmit` is the build check | Emit to `dist` | No build order, no stale output |
| TS flags | Base adds `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, lib `["ES2023", "ESNext.Disposable"]`; relative imports end in `.ts` | `.js` specifiers | Roots can run on Node 26 type stripping |
| Demos | One package per demo; roots and adapters are folders; demos 1 and 2 export only `./module` | One package per root | PLAN § 1.1; `exports` blocks deep imports |
| Tests | One root `vitest.config.ts`, no workspace test scripts | Vitest per package | Core gains no devDependencies; one coverage gate |
| Dependency rule | Pure function over a file snapshot (fs walk, regex import scan) | dependency-cruiser, ESLint boundaries, TS compiler API | No new tool; TypeScript 7 has no stable JS API |
| Child scope | Reuse a parent singleton unless its dependency closure meets a child registration | Never share; always delegate | Fakes reach dependents; request scopes keep shared state (quote freeze) |
| Factory argument | `Resolver` (resolve only) | Full `Container` | Factories cannot register |
| Duplicates | `register` twice in one container throws; overrides go through `child()` | Last write wins | Module collisions fail fast |
| Statuses | String unions of contract state names; ordinals stay in adapters with ABI types | Numeric enums | Standards § 2: no hand-copied enums |
| `PaymentGateway` | Paying side only; seller and facilitator are Demo 1 edge adapters using core types | Three role ports now | Only agent code calls it (YAGNI) |
| Profiles | Static values in code; env only for machine values | Everything in env | Demo moments are versioned |
| CI | `typecheck` and `test` run the root scripts | Matrix per workspace | Same commands as local |

## Workspaces

`pnpm-workspace.yaml` packages: `apps/*`, `packages/*`, `demos/*`, `e2e/*`. Each new workspace: `package.json`
(`private`, `type: module`, `version: 0.0.0`, `exports`, script `typecheck: tsc --noEmit`) and a `tsconfig.json`
extending the base. Placeholders hold one entry file with `export {};`; demo folders hold `.gitkeep`.

| Path | Package | Entry |
|---|---|---|
| `apps/web` | `@hackatwin/web` | `src/index.ts` |
| `packages/core` | `@hackatwin/core` | `src/index.ts`; `./testing` is `src/testing/index.ts` |
| `packages/config` | `@hackatwin/config` | `src/index.ts` (`types: ["node"]`) |
| `packages/{chains,pricing,agent-kit,ui}` | `@hackatwin/<dir>` | `src/index.ts` |
| `packages/contracts` | `@hackatwin/contracts` | `abi/index.ts` (Foundry owns `src/`) |
| `demos/01-x402-twin` | `@hackatwin/demo-01-x402-twin` | `module.ts`; folders `seller-api`, `facilitator`, `buyer-agent`, `adapters`, `scripts` |
| `demos/02-l1-crosschain` | `@hackatwin/demo-02-l1-crosschain` | `module.ts`; folders `l1`, `adapters`, `payment-agent`, `scripts` |
| `demos/03-agentic-crosschain-commerce` | `@hackatwin/demo-03-agentic-crosschain-commerce` | `main.ts`, no `exports` |
| `e2e/{protocol,ui,smoke}` | `@hackatwin/e2e-<dir>` | `src/index.ts` |

`apps/docs` keeps its name and TypeScript 5.9.3. Root scripts: `typecheck` is `tsc --noEmit && pnpm -r --if-present
typecheck` (root `tsconfig.json` covers `test/` and `vitest.config.ts`, `types: ["node"]`); `test` is `vitest run
--coverage`. Vitest includes `test/**/*.test.ts` and `{apps,packages,demos}/**/*.test.{ts,tsx}` (e2e runs later in
its own jobs); v8 coverage over `packages/*/src/**` with `branches: 100` for `packages/core/src/container.ts`. Catalog
adds `vitest`, `@vitest/coverage-v8`, `zod`, `@types/node`: resolve exact versions with `npm view` at apply (expected
4.x, 4.x, 4.x, 26.x).

## Container

```ts
export type Token<T> = symbol & { readonly __type?: T };
export const token = <T>(name: string): Token<T> => Symbol(name) as Token<T>;
export type Scope = 'singleton' | 'transient';
export interface Resolver { resolve<T>(token: Token<T>): T }
export interface Container extends Resolver, AsyncDisposable {
  register<T>(token: Token<T>, factory: (r: Resolver) => T, scope?: Scope): void;
  child(): Container;
  dispose(): Promise<void>;
}
export declare function createContainer(): Container;
export class ContainerError extends Error {}
```

Resolving `T` from container `C` with path `P`:

1. `T` in `P`: throw `Circular dependency: A -> B -> A` (token descriptions).
2. Walk from `C` to the root, collecting `shadow` (tokens registered in containers already passed). A cached `T`
   whose closure misses `shadow` is returned. The first container registering `T` is the owner; none throws
   `No registration for "T"`, with the path when nested.
3. Run the owner's factory with a tracking resolver bound to `C` and `P + T`, so child overrides reach dependencies.
   The resolver throws once its factory has returned.
4. Closure: `{T}` plus every resolved dependency's closure.
5. Singleton: cache at the deepest container from `C` to the owner that registers a closure token, and append to its
   creation list. Transient: return uncached; the closure still propagates.

`dispose()` is idempotent and marks the container disposed (later `register`, `resolve`, `child`, or placement into it
throw). It calls `[Symbol.asyncDispose]`, else `[Symbol.dispose]`, on its own creation list in reverse and throws one
`AggregateError` for failures. Children never dispose parent instances. `[Symbol.asyncDispose]` aliases `dispose`.

## Domain and ports

Files: `packages/core/src/domain/{money,payment,agent-event}.ts`, `src/ports/<port>.ts` plus `tokens.ts`.

```ts
export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type AssetSymbol = 'ARGt' | 'USDC';
export type Currency = AssetSymbol | 'USD';
export interface Money { readonly units: bigint; readonly decimals: number; readonly currency: Currency }
// money, parseMoney, formatMoney, addMoney, compareMoney throw MoneyError on mismatch; convertMoney rounds up
export type PaymentStatus = 'None' | 'Pending' | 'Settled' | 'Dispatched' | 'Refunded' | 'Received' | 'Rejected';
export interface PaymentIntent {
  readonly id: string; readonly payer: Address; readonly payee: Address;
  readonly amount: Money; readonly chainId: number; readonly status: PaymentStatus;
}
export interface Quote {
  readonly price: Money; readonly rate: Money; readonly amount: Money;
  readonly source: 'curve' | 'chainlink'; readonly guarded: boolean; readonly validUntil: number;
}

export interface PaymentGateway { pay(request: PaymentRequest): Promise<PaidResponse> }
export interface PaymentRequest { readonly url: string; readonly method: 'GET' | 'POST'; readonly body?: string; readonly maxAmount: Money }
export interface PaidResponse { readonly status: number; readonly body: string; readonly payment?: PaymentIntent }

export interface AgentPolicy {
  authorize(amount: Money): Promise<{ readonly allowed: boolean; readonly reason: string }>;
  record(amount: Money): Promise<void>;
}

export interface AgentIdentity {
  register(agentUri: string): Promise<bigint>;
  giveFeedback(feedback: Feedback): Promise<Hex>;
  reputation(agentId: bigint): Promise<Reputation>;
}
export interface Feedback { readonly agentId: bigint; readonly value: bigint; readonly valueDecimals: number; readonly tag1: string; readonly tag2: string }
export interface Reputation { readonly agentId: bigint; readonly count: bigint; readonly value: bigint; readonly valueDecimals: number }

export interface ChainClient {
  readonly chainId: number;
  read<T>(call: ContractCall): Promise<T>;
  write(call: ContractCall): Promise<Hex>;
  waitForReceipt(txHash: Hex): Promise<Receipt>;
}
export interface ContractCall { readonly address: Address; readonly abi: readonly unknown[]; readonly functionName: string; readonly args?: readonly unknown[] }
export interface Log { readonly address: Address; readonly topics: readonly Hex[]; readonly data: Hex }
export interface Receipt { readonly txHash: Hex; readonly status: 'success' | 'reverted'; readonly blockNumber: bigint; readonly logs: readonly Log[] }

export interface LLM { complete(request: LlmRequest): Promise<LlmReply> }
export type LlmContent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'tool_use'; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly type: 'tool_result'; readonly toolUseId: string; readonly content: string; readonly isError: boolean };
export interface LlmMessage { readonly role: 'user' | 'assistant'; readonly content: readonly LlmContent[] }
export interface ToolSpec { readonly name: string; readonly description: string; readonly inputSchema: Readonly<Record<string, unknown>> }
export interface LlmRequest { readonly system: string; readonly messages: readonly LlmMessage[]; readonly tools: readonly ToolSpec[] }
export interface LlmReply { readonly content: readonly LlmContent[]; readonly reasoning?: string; readonly stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' }

export interface PriceOracle { quote(price: Money, asset: AssetSymbol): Promise<Quote> }

export interface CrossChainMessenger {
  send(transfer: Transfer): Promise<string>;
  track(messageId: string): AsyncIterable<Hop>;
}
export interface Transfer { readonly destinationChainId: number; readonly recipient: Address; readonly amount: Money; readonly payload?: Hex }
export interface Hop {
  readonly index: number; readonly transport: 'ccip' | 'local' | 'ictt' | 'icm';
  readonly chainId: number; readonly status: PaymentStatus; readonly txHash: Hex; readonly explorerUrl: string;
}

export const Ports = {
  PaymentGateway: token<PaymentGateway>('PaymentGateway'),
  AgentIdentity: token<AgentIdentity>('AgentIdentity'),
  AgentPolicy: token<AgentPolicy>('AgentPolicy'),
  ChainClient: token<ChainClient>('ChainClient'),
  LLM: token<LLM>('LLM'),
  PriceOracle: token<PriceOracle>('PriceOracle'),
  CrossChainMessenger: token<CrossChainMessenger>('CrossChainMessenger'),
} as const;
```

### AgentEvent v1

Every event carries `version: 1`, `type`, and `at` (epoch ms).

| `type` | Payload |
|---|---|
| `run.started` | `agent`, `profile` |
| `llm.reasoning` | `text` |
| `llm.tool-call` | `tool`, `input` |
| `policy.decision` | `amount: Money`, `allowed`, `reason` |
| `payment.required` | `resource`, `quote: Quote` |
| `payment.signed` | `intent: PaymentIntent` |
| `payment.status` | `paymentId`, `chainId`, `from` and `to` (`PaymentStatus`), `txHash` |
| `hop` | `messageId`, `hop: Hop` |
| `resource.received` | `resource`, `status` |
| `identity.feedback` | `agentId: bigint`, `txHash` |
| `run.finished` | `reason: 'done' \| 'max-steps' \| 'refusal' \| 'error'`, `message?` |

`encodeAgentEvent` writes bigints as decimal strings. `decodeAgentEvent` rejects an unknown `version` or `type` with
`AgentEventError` and revives `units` and `agentId`, the only bigint keys allowed in events.

### Fakes (`@hackatwin/core/testing`)

| Fake | Behavior |
|---|---|
| `FakePaymentGateway` | Replays scripted responses; records requests |
| `FakeAgentIdentity` | In-memory registry, ids from `1n`, reputation from stored feedback |
| `FakeAgentPolicy` | Decision function (default allow); records calls |
| `FakeChainClient` | Reads from a map keyed `address:functionName`; sequential tx hashes; scripted receipt logs |
| `ScriptedLLM` | Replies in order; throws when exhausted; records requests |
| `FakePriceOracle` | Fixed rate, injected clock, `convertMoney` |
| `FakeCrossChainMessenger` | Sequential message ids; `track` yields scripted hops |

No clock or randomness unless injected.

## Config

`loadProfile(name, env = process.env)` lives in `packages/config/src/load-profile.ts` (a `ProfileName` literal returns
that profile's type; any string returns the `Profile` union):

1. Unknown name: `ConfigError` listing the four names. Empty strings count as missing.
2. Raw-key guard: for each keystore role, `<ROLE>_PRIVATE_KEY`, `<ROLE>_KEYSTORE_PASSWORD`, or `PRIVATE_KEY` set, or a
   `<ROLE>_KEYSTORE` matching 64 hex digits, adds an issue naming the variable, never the value.
3. `safeParse` the profile's zod object, keyed by variable names so issue paths are variable names, then merge static
   values.
4. Any issue: one `ConfigError` with `issues: { variable, message }[]` and one `VARIABLE: reason` line each. No values
   or zod dumps.

| Profile | Static asset, x402 method | Env besides `ANTHROPIC_API_KEY` | Keystore roles |
|---|---|---|---|
| `cchain-fork` | ARGt, permit2 | `CCHAIN_FORK_RPC_URL` (loopback), `CCHAIN_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL` | agent, seller, facilitator |
| `fuji-crosschain` | USDC, none (CCIP + ICTT) | `SEPOLIA_RPC_URL`, `FUJI_RPC_URL`, `TWINPAY_L1_RPC_URL`, `TWINPAY_L1_CHAIN_ID` | agent, treasury |
| `twinpay-l1` | USDC, permit2 | `TWINPAY_L1_RPC_URL`, `TWINPAY_L1_CHAIN_ID`, `FUJI_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL` | agent, seller, facilitator |
| `fuji-cchain` | USDC, eip3009 | `FUJI_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL` | agent, seller, facilitator |

Each role reads `<ROLE>_KEYSTORE` (`[A-Za-z0-9._-]`, no path) and `<ROLE>_KEYSTORE_PASSWORD_FILE` (absolute path, read
by the root in T4.2). Static everywhere: `llm: { provider: 'claude', model: 'claude-sonnet-5-5' }`, budget 1 USD per
payment and 5 USD total (6 decimals, tuned in T5.6 and T8.3), `facilitator: 'x402-ts'` on x402 profiles. URLs accept
`http(s)` and `ws(s)`; loopback is `localhost`, `127.0.0.1`, `[::1]`; chain IDs are positive integers. Exports:
`loadProfile`, `PROFILE_NAMES`, `ENV_VARIABLES` (every schema key), `Profile`, `ProfileToken`, `ConfigError`.
The fork guard covers `CCHAIN_FORK_RPC_URL` only: it is the one RPC that receives signed transactions. `CCHAIN_RPC_URL`
(the anvil upstream) and the oracle RPCs are mainnet read-only by design. Enums hold exactly the values in this table.
`.env.example` lists every `ENV_VARIABLES` entry, empty.

## Dependency rule

`test/dependency-rule.ts` exports `readSnapshot(root)` and `checkDependencyRule(snapshot): Violation[]`. The snapshot
walks `apps`, `packages`, `demos`, `e2e` (skipping `node_modules`, `dist`, `build`, `coverage`, `.next`,
`.docusaurus`) and reads every `package.json` and `*.{ts,tsx,mts,cts}`. A file belongs to the workspace with the
longest matching directory. Specifiers come from `import`/`export ... from`, side-effect imports, `import()`, and
`require()`, type-only included.

| Rule | Fails when |
|---|---|
| R1 | Core's manifest has `dependencies`, `peerDependencies`, or `optionalDependencies`, or a non-test core file imports a non-relative specifier |
| R2 | A `packages/*` or `apps/*` file or manifest references `@hackatwin/demo-*` |
| R3 | A `demos/*` or `e2e/*` reference to a demo is not `<demo>/module`, or comes from a demo other than Demo 3 |
| R4 | A relative import resolves outside its workspace (the allowed Demo 3 edge must use the package specifier, e.g. `@hackatwin/demo-01-x402-twin/module`) |
| R5 | A non-test file imports `@hackatwin/core/testing` (test: `*.test.ts(x)` or any `e2e/*` file) |
| R6 | `process.env`, `process['env']`, or an import from `process` or `node:process` appears outside `packages/config/src/load-profile.ts` |

Violations print `R<n> <file>: <specifier>: <reason>`; for R1 the specifier is the offending package name. `test/dependency-rule.test.ts` checks the real repo (no
violations) and one in-memory fixture per rule and spec scenario.

## CI

- `changes`: new output and filter `ts`: `*root`, `test/**`, `vitest.config.ts`, `tsconfig.json`, `.env.example`,
  `packages/**`, `demos/**`, `apps/web/**`, `e2e/**`.
- `typecheck` and `test`: `needs: changes`, `if: needs.changes.outputs.ts == 'true'`, `timeout-minutes: 10`, the
  `biome` job's setup and frozen install, then `pnpm typecheck` or `pnpm test`.
- `ci-gate.needs` adds `typecheck` and `test` (ADR 0002).

## File Changes

| File | Action | Description |
|---|---|---|
| `pnpm-workspace.yaml`, `package.json` | Modify | Globs, catalog, root scripts and devDependencies |
| `tsconfig.base.json` | Modify | Four flags above |
| `tsconfig.json`, `vitest.config.ts` | Create | Root typecheck and tests |
| `test/dependency-rule.ts`, `test/dependency-rule.test.ts` | Create | Rule and tests |
| 14 workspace directories | Create | Placeholders |
| `packages/core/src/container.ts`, `domain/*`, `ports/*`, `testing/*`, tests | Create | T3.2, T3.3 |
| `packages/config/src/{env,profiles,load-profile,index}.ts`, tests | Create | T3.4 |
| `.env.example` | Modify | Every profile variable |
| `.github/workflows/ci.yml` | Modify | Filter, jobs, gate |
| `docs/adr/0005-config-package-outside-core.md`, `docs/adr/README.md` | Create, Modify | Written in this phase |
| `docs/PLAN.md` § 2, `README.md` | Modify | Add `packages/config`; core drops config schemas |
| `pnpm-lock.yaml` | Modify | Generated |

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | Container (100% branches), Money, event codec, fakes, profiles, raw-key and fork guards, `.env.example` coverage | Vitest, plain records, injected clocks |
| Structure | Dependency rule | Real repo plus fixtures |
| Type | Fakes implement each port; placeholders compile | `pnpm typecheck` |
| E2E | None in M3 | N/A |

## Threat Matrix

N/A: no routing, subprocess, VCS or PR command composition, or executable classification. The rule reads files with
`fs` (no `git`), and the new CI jobs run fixed commands with no PR-controlled input.

## Migration / Rollout

No migration; nothing consumes core before M4. Slice seams for tasks: T3.1a scaffold, CI, ADR 0005, PLAN and README;
T3.1b dependency rule; T3.2 container; T3.3a domain, codec, ports; T3.3b fakes; T3.4 config. T3.4 checks TypeScript 7
with zod first; the fallback pins `typescript` 5.9.3 in `packages/config` only.

## Open Questions

- [ ] `apps/web` needs demo modules (PLAN § 1.3), but R2 forbids it per spec; revisit in M10.
- [ ] `TWINPAY_L1_CHAIN_ID` leaves env once T6.1 records the ID in `packages/chains`.
- [ ] Verify at apply: pnpm puts the root `node_modules/.bin` on workspace script `PATH` (else a `typescript`
  devDependency per workspace); lib `ESNext.Disposable` exists in TypeScript 7 (else `ESNext`).
- [ ] How adapters emit `AgentEvent`s (sink token or iterator) is decided in T5.8.
