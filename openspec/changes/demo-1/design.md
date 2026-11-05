# Design: Demo 1, x402 + Twin on a C-Chain fork (M5)

## Technical Approach

An agent with an ERC-8004 identity buys an ARS/USD quote over x402 and pays real ARGt on a pinned anvil fork of
C-Chain (43114). Four processes, each a composition root wired from `cchain-fork` through `registerX402Module`:

| Process | Root | Address | Key |
|---|---|---|---|
| anvil | `demos/01-x402-twin/scripts/fork.ts` (spawns it, then exits) | `127.0.0.1:8545` | none |
| Facilitator | `demos/01-x402-twin/facilitator/main.ts` | `127.0.0.1:4020` | facilitator |
| Seller API | `demos/01-x402-twin/seller-api/main.ts` | `127.0.0.1:4021` | seller (registration; `payTo`) |
| Buyer | `demos/01-x402-twin/buyer-agent/main.ts` | none | agent |

Two rules carry safety: every viem client, including SDK signers and anvil cheats, comes from `packages/chains`
behind one fail-closed guard ([ADR 0007](../../../docs/adr/0007-guarded-sdk-clients.md)); `--scripted` is a labeled
LLM adapter on the live path ([ADR 0008](../../../docs/adr/0008-scripted-llm-mode.md)).

## Architecture Decisions

| Area | Decision | Rejected |
|---|---|---|
| SDK and cheat safety | `createGuardedClients`: one probe, read-method allowlist when refused, local accounts refuse to sign; `createChainClient` rebuilt on it; R9 bans viem client construction elsewhere | Per-action checks; per-SDK wrappers |
| Fork start | `anvil --fork-url <upstream> --fork-block-number N --chain-id 43114 --hardfork cancun --host 127.0.0.1 --port 8545`, argv array, detached, pid and log in `.demo1/`; a fork already at `N` (`anvil_nodeInfo`) is a no-op | Foreground anvil (no rerun no-op); `--auto-impersonate` |
| Clock | `syncClock`: head more than 30 s behind wall time → `evm_setNextBlockTimestamp(now)` + `evm_mine`; at fork start and in every buyer preflight | No sync: Permit2 `validAfter` and the now + 6 s deadline check fail on an old `N` |
| `N` | `CCHAIN_FORK_BLOCK` code static in `cchain-fork`, checked by the statics schema at load, printed by `demo1:fork-block` | Env var (dev and CI drift) |
| Keystores | `encryptKeystore` (V3, scrypt, Foundry-compatible) beside `decryptKeystore`; `.demo1/` 0700, files 0600 written with `wx`; generated only when env names no keystore | `cast wallet new` (password on argv or env) |
| Env wiring | Fork script writes non-secret `.demo1/demo1.env`; scripts run `node --env-file-if-exists=.demo1/demo1.env --env-file-if-exists=.env`, so `.env` and the shell win | A `defaults` option in `loadProfile`; ten manual variables |
| LLM selection | `loadProfile(name, env, { llm })`; `claude` needs the key (model default `claude-sonnet-5-5`), `scripted` and omitted do not | Key always required |
| Funding | Target T = guarded quote of 2 x `budget.total`, persisted in `.demo1/funding.json` per `forkBlock`; top up: `setBalance` 10 AVAX when under 1 AVAX for agent, seller, facilitator, and adapter; mint the shortfall below T from the impersonated adapter; `approve(Permit2, T)` when below; assert balance >= T and allowance == T | Recompute per run (rate drift mints more); `maxUint256` |
| Facilitator | Hono app over a `FacilitatorLike` seam (`supported`, `verify`, `settle`), zod bodies, 16 KB limit; root registers `ExactEvmScheme` on `eip155:43114` with `toFacilitatorEvmSigner(fork.wallet(facilitator))`; exits if the guard refuses or `PERMIT2_ADDRESS` / `x402ExactPermit2ProxyAddress` differ from the registry | Hosted facilitator (cannot reach the fork) |
| Seller | `@x402/hono` `paymentMiddleware`, `maxTimeoutSeconds: 30`; money parser converts USD through `PriceOracle` to an ARGt `AssetAmount` (`assetTransferMethod: 'permit2'`, no `name`/`version`), `extra.quote` = source, guarded, rate; parser throws on oracle error, `onError` answers 503 | Static `AssetAmount` (stale after the freeze) |
| x402 client | Explicit two-request flow in `X402PaymentGateway` over an `X402Engine` built on `x402Client` (with `registerExactEvmScheme` and `toClientEvmSigner`) and `x402HTTPClient` from `@x402/core/client`; no `@x402/fetch` dependency | `wrapFetchWithPayment` (no hook between 402 and signing for ceiling, policy, allowance) |
| Rate trust | `maxAmount` = buyer's own quote of `budget.perPayment`; policy values the ask in USD at the buyer's rate, rounded up; allowance via `getPermit2AllowanceReadParams`; payloads with approval extensions rejected | Trusting `extra.quote` |
| Events | LLM reasoning and tool calls are emitted once per completed reply, in content order; only tool-run events stream live, through `EventChannel.until(work)` | Token streaming (widens the `LLM` port) |
| Bad tool calls | Unknown tool or schema-invalid input ends the run (`run.finished` reason `error`), nothing runs; unknown keys are stripped | Error result and continue |
| Identity | `Erc8004Identity` over the `ChainClient` port; `register` decodes `Registered`; `giveFeedback(id, value, 0, 'x402', 'fx-quote', '', '', 0x0)`; `ownerOf` and approval pre-check throws `SelfFeedbackError`; agentURI is a base64 `data:` registration-v1 JSON | IPFS hosting |
| Rating | `rate_seller` once, only after a 200 in this run, only if `ownerOf(sellerAgentId)` equals the paid `payTo`; id from `.demo1/identities.json` | LLM-chosen `agentId` |
| Composition | `module.ts` and `tokens.ts` start in PR 3; roots await keystores and guarded clients, register them, then call `registerX402Module` (registers only) | Module last (roots rewired) |
| E2E oracle | `FakePriceOracle` at 1658.36 via `child()`; fine under C1: all contracts are real fork bytecode, only an off-chain read is fixed, the live oracle keeps its nightly tests | Live oracle in PR CI |
| CI | `fork` Vitest project and job from PR 2: pinned Foundry, `~/.foundry/cache/rpc` keyed `foundry-rpc-43114-<N>`, anvil stopped with SIGINT so the cache flushes | Job in PR 13 |

## Data Flow

```text
pnpm demo1 [--scripted]
 buyer root: loadProfile(llm) -> agent keystore -> guarded fork client -> preflight -> createAgent
   quote ------> own GuardedOracle (Arbitrum Curve, Base Chainlink)
   buy --------> X402PaymentGateway --GET--> seller :4021 (@x402/hono)
                 <--402 PAYMENT-REQUIRED (ARGt amount, maxTimeoutSeconds 30, extra.quote)
                 ceiling -> policy (USD) -> allowance -> sign Permit2 (guarded agent account)
                 --GET + PAYMENT-SIGNATURE--> seller --verify/settle--> facilitator :4020
                                                 facilitator -> x402 proxy -> Permit2 -> ARGt (anvil 43114 @ N)
                 <--200 + PAYMENT-RESPONSE (tx hash)
   rate_seller -> ERC-8004 Reputation.giveFeedback(seller agentId)
 AgentEvent stream -> CLI lines, balances before and after
```

Happy-path events: `run.started(llm)`, `llm.reasoning`, `llm.tool-call` (quote, buy), `payment.required`,
`policy.decision`, `payment.signed`, `payment.status` (Pending to Settled), `resource.received` (200),
`llm.tool-call` (rate_seller), `identity.feedback`, `run.finished(done)`. A ceiling refusal emits
`policy.decision` with `allowed: false, reason: 'above_max_amount'` and signs nothing.

| Command | Does |
|---|---|
| `pnpm demo1:fork` | Keystores if absent, `demo1.env`, upstream state at `N` (else exit 1 naming `N`), anvil, clock sync |
| `pnpm demo1:fund` | Gas for four roles, shortfall mint, bounded approve, assertions |
| `pnpm demo1:register` | Registers agent and seller once, writes `identities.json`, prints both ids |
| `pnpm demo1:facilitator`, `pnpm demo1:seller` | Long-running services |
| `pnpm demo1 [--scripted]` | Preflight (guard, fork at `N`, clock, identities, funding, services), balances, run, balances |
| `pnpm demo1:fork-block`, `pnpm test:fork` | Print `N` for CI; run the fork project |

## Component Contracts and Tests

| Element | Function or rule | Test |
|---|---|---|
| `KEYSTORE_DIR` | `envSchemas.KEYSTORE_DIR`: optional absolute path; roots pass it to `loadKeystoreAccount(name, file, dir)` | `load-profile.test.ts`: `/abs/.demo1` carried; `.demo1` rejected naming `KEYSTORE_DIR` |
| Fork block | `CCHAIN_FORK_BLOCK` and `forkStaticsSchema` (`forkBlock: z.bigint().positive()`) | `load-profile.test.ts`: profile reports the static; schema rejects missing, 0, -1 naming `forkBlock` |
| LLM selection | `loadProfile(..., { llm })`; Claude model from `staticValues.llm.model` (`claude-sonnet-5-5`) | Claude without key fails naming `ANTHROPIC_API_KEY`; scripted and omitted pass; default model asserted |
| Seller paid body | `paidQuoteBody(quote)` returns pair `ARS/USD`, `quote` (rate, source, guarded, validUntil), `sources` (Curve, Chainlink), `disclaimer: 'market rate, not official'` | `seller-app.test.ts` against the real middleware and a fake facilitator |
| Failed settlement | `createSellerApp` releases the paid body only after settle succeeds; a failure returns the SDK error status | `seller-app.test.ts`: settle failure gives no 200 and no `quote` in the body |
| Claude refusal | `ClaudeLLM.complete` maps `stop_reason: 'refusal'` to `stopReason: 'refusal'`; `createAgent` emits `run.finished` reason `refusal` | `claude-llm.test.ts` (fake SDK client); `create-agent.test.ts` |
| Claude retries | SDK `maxRetries: 3`; the exhausted error is rethrown as `LlmError` without the key; `createAgent` emits `run.finished` reason `error` | One 529 then success; always 500 gives `LlmError` whose message lacks the key |
| Max steps | `createAgent` counts LLM calls; at `maxSteps` (default 8) emits `run.finished` reason `max-steps`, message `stopped after N steps` | `create-agent.test.ts`: always-tool LLM with `maxSteps: 3` |
| Caps from profile only | `new BudgetPolicy(profile.budget, emit)` is the only constructor; tool schemas carry no cap and strip unknown keys | `budget-policy.test.ts` at and above both caps; `tools.test.ts`: `buy` with a `cap` key still meets the profile caps |
| Ceiling reason | `X402PaymentGateway` emits `policy.decision` (`above_max_amount`) before the policy is called | `payment-gateway.test.ts`: ask `maxAmount + 1` signs nothing, policy untouched |
| Runbook | `test/demo-1-runbook.test.ts` scans the Demo 1 section of `docs/demos.md` for `pnpm <script>` and checks root `package.json` scripts | Fails on an unknown script name |
| Reputation | `Erc8004Identity.reputation(id)`: `getClients(id)`, then `getSummary(id, clients, '', '')` mapped to `Reputation`; the ABI is checked against `erc-8004-contracts` 2.0.0 in PR 7 | Fork test: count 1 after one feedback |

## File Changes

| PR | Files |
|---|---|
| 1 | `packages/config/src/{env,profiles,load-profile}.ts` (+tests); `packages/core/src/domain/agent-event.ts` (+test); `.env.example`, `.gitignore`, `pnpm-workspace.yaml` catalog; ADR 0008 |
| 2 | `packages/chains/src/{guarded-clients,anvil}.ts`, `keystore/encrypt.ts` (+tests); `chain-client.ts`; `test/dependency-rule.ts` R9; `demos/01-x402-twin/{state.ts,scripts/fork.ts,scripts/fork-block.ts}`; `vitest.config.ts`, `ci.yml`, `package.json`; ADR 0007 |
| 3 | `demos/01-x402-twin/{module.ts,tokens.ts,adapters/funding.ts,scripts/fund.ts}` (+unit and fork tests) |
| 4 | `adapters/{facilitator-app,sdk-addresses}.ts` (+tests), `facilitator/main.ts`, fork settle test |
| 5 | `adapters/{seller-app,argt-money-parser}.ts`, `seller-api/main.ts` (+tests) |
| 6 | `packages/agent-kit/src/x402/{payment-gateway,engine,errors}.ts` (+tests); `@x402/core`, `@x402/evm` deps |
| 7 | `packages/agent-kit/src/identity/{erc8004-identity,abi,errors}.ts`; `adapters/registration.ts`, `scripts/register.ts` |
| 8 | `packages/agent-kit/src/policy/budget-policy.ts` (+test) |
| 9 | `packages/agent-kit/src/llm/claude-llm.ts` (+test) |
| 10 | `packages/agent-kit/src/runner/{create-agent,event-channel,tool}.ts`, `llm/scripted-plan-llm.ts` (+tests) |
| 11 | `demos/01-x402-twin/buyer-agent/{main,tools,scripted-plan,prompt,format}.ts` (+tests), `adapters/balances.ts` |
| 12 | Import test from another workspace; `test/demo-1-runbook.test.ts`; `docs/demos.md` Demo 1 commands |
| 13 | `e2e/protocol/src/{demo-1.test.ts,support/fork-setup.ts}`, `e2e/protocol/package.json` |

## Interfaces / Contracts

```ts
// packages/chains
export interface GuardedClients {
  readonly chainId: number;
  readonly refusal: string | undefined;
  readonly public: PublicClient;
  wallet(account: Account): WalletClient & PublicActions;
  chainClient(account?: Account): ChainsClient;
  cheats(): AnvilCheats;
}
export interface AnvilCheats {
  impersonate(address: Address): Promise<void>;
  stopImpersonating(address: Address): Promise<void>;
  setBalance(address: Address, wei: bigint): Promise<void>;
  syncClock(nowSeconds: bigint): Promise<bigint>;
  forkBlock(): Promise<bigint | undefined>;
  snapshot(): Promise<Hex>;
  revert(id: Hex): Promise<void>;
}

// packages/config
export type LlmConfig = { readonly provider: 'claude'; readonly model: string } | { readonly provider: 'scripted' };
export function loadProfile<N extends ProfileName>(name: N, env?: Env, options?: { llm?: LlmConfig['provider'] }): Profile<N>;

// packages/core delta
type RunStarted = Base<'run.started'> & { readonly agent: string; readonly profile: string; readonly llm: 'claude' | 'scripted' };

// packages/agent-kit
export type Emit = (event: AgentEvent) => void;
export interface EventChannel {
  readonly emit: Emit;
  until<T>(work: Promise<T>): AsyncGenerator<AgentEvent, T>;
}
export interface Tool<I> {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType<I>;
  run(input: I, context: { readonly emit: Emit; readonly policy: AgentPolicy }): Promise<string>;
}
export function createAgent(options: {
  llm: LLM; llmName: LlmConfig['provider']; tools: readonly Tool<never>[]; policy: AgentPolicy;
  channel: EventChannel; system: string; prompt: string; agent: string; profile: string; maxSteps?: number;
}): AsyncIterable<AgentEvent>;
export interface X402Engine {
  required(response: Response): Promise<PaymentRequired>;
  sign(required: PaymentRequired, accepted: PaymentRequirements): Promise<Record<string, string>>;
  settlement(response: Response): Settlement | undefined;
}
```

`X402PaymentGateway.pay`, in order: GET; on 402 decode and pick the `exact` ARGt Permit2 entry for `eip155:43114`;
refuse above `maxAmount`; `authorize(ask)`; allowance or `AllowanceShortfallError`; sign; retry with
`PAYMENT-SIGNATURE`; 200 with settlement is Settled, anything else is Rejected. No signature exists before the
checks pass.

Claude adapter: `tool_choice: { type: 'auto' }`, model from config (default `claude-sonnet-5-5`), SDK
`maxRetries: 3`; thinking blocks become `reasoning`, and raw assistant blocks are kept by `tool_use` id and replayed so
thinking signatures survive without widening the port. Demo 1 tokens: `Config`, `Accounts`, `Fork`, `ReadChains`,
`State`, `Events`, `Funding`, `Registration`, `FacilitatorApp`, `SellerApp`, `Buyer`, `Balances`.

SDK touchpoints: every name above exists in the published 2.29.0 declarations (see the last section). Still
runtime-only: whether a custom `extra.quote` reaches the 402 body (PR 5); if it does not, the seller puts the rate
source in the route description.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Guard allowlist, refused signing and cheats, `anvilArgs`, keystore round trip, config deltas, event codec, every row of Component Contracts except the fork rows, funding idempotence, facilitator app | Default project; scripted transports, `FakeChainClient`, fake fetch and engine, fake SDK client |
| Fork | Funding (four roles, top up), facilitator settle and expired deadline, register, feedback, reputation | `fork` project; anvil at `N` on port 8546, `evm_snapshot` per test |
| E2E | 402 to 200, deltas equal the quote, one feedback on the seller id, reputation count 1 | `demo-1.test.ts`: in-memory fresh keys, module plus `child()` overrides, ephemeral loopback ports |
| Manual | `pnpm demo1` on Claude | Rehearsal |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: nothing is classified or executed by path | None | None |
| Git repository selection, commit, push, PR commands | N/A: no VCS or PR automation | None | None |
| Subprocess: anvil | Applicable | `spawn('anvil', args, { shell: false })`; host fixed `127.0.0.1`; upstream must be http(s) and is never logged; port 1024 to 65535; readiness timeout kills the child | Non-http upstream and bad port rejected; host always loopback; a URL with spaces stays one argv element; `shell: false` |
| Local HTTP services | Applicable | Bind `127.0.0.1`; 16 KB body limit; zod facilitator bodies | Loopback bind; oversized and malformed bodies get 4xx; unsupported network rejected |
| Fork state files | Applicable | `.demo1/` 0700, secrets 0600 with `wx`, no key printed | Modes; no overwrite; output has no 64-hex key |

## Migration / Rollout

No data migration; fork state is disposable. Slicing changes for `sdd-tasks`: the CI fork job moves to PR 2; module
and tokens start in PR 3; if PR 2 exceeds 400 lines, guarded clients and R9 split into `feature/guarded-sdk-clients`
first.

Spec reconciliation (specs updated to match):

- fork-environment: gas for agent, seller, facilitator, and adapter; shortfall top-up; balance >= T, allowance == T.
- config-profiles: `loadProfile(name, env, { llm })`, omitted `llm` needs no key; `forkBlock` scenarios are
  schema-level tests of the static `CCHAIN_FORK_BLOCK`.
- claude-llm: events per completed reply; live streaming only for tool-run events.
- agent-runner: unknown or invalid tool calls end the run with reason `error`; max steps ends with `max-steps`.
- budget-policy: `above_max_amount` joins the `policy.decision` reasons, emitted by the x402 client.
- x402-client and proposal PR 6: `x402Client` and `x402HTTPClient` from `@x402/core`, no `@x402/fetch`.

## Open Questions

- [ ] Whether a custom `extra.quote` reaches the 402 body (PR 5).
- [ ] ERC-8004 v2 `getSummary` and `getClients` signatures (PR 7).
- [ ] Claude 1.4.0 thinking block shape for `claude-sonnet-5-5` (PR 9).
- [ ] Foundry version pin for CI (PR 2); O13 for stage use of `--scripted`.

## Verified by the orchestrator (2026-11-04, published 2.29.0 type declarations on jsDelivr)

- `@x402/core/client`: `x402Client`, `x402HTTPClient`. `@x402/core/facilitator`: `x402Facilitator`. `@x402/core/server` and `/http`: `HTTPFacilitatorClient`, `x402ResourceServer`. `@x402/core` depends on `zod ^4.6.6` (compatible with the catalog 4.6.7).
- `@x402/evm` root: `PERMIT2_ADDRESS`, `x402ExactPermit2ProxyAddress`, `toClientEvmSigner`, `toFacilitatorEvmSigner`, `getPermit2AllowanceReadParams`, `createPermit2ApprovalTx`. `@x402/evm/exact/client`: `registerExactEvmScheme`. `@x402/evm/exact/facilitator` and `/exact/server`: `ExactEvmScheme`, `registerExactEvmScheme`.
- `@x402/hono`: `paymentMiddleware`, `x402ResourceServer`, `x402HTTPResourceServer`. `@x402/fetch`: `wrapFetchWithPayment`, `x402Client`.
- Still runtime-only (verify in PR 5): whether a custom `extra.quote` reaches the 402 body.
- Versions: `hono` 4.13.16, `@hono/node-server` 2.1.6, `@anthropic-ai/sdk` 1.4.0.
