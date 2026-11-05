# Proposal: Demo 1, x402 + Twin on a C-Chain fork (M5)

## Intent

M4 shipped the registry, a guarded viem client, keystores, and `GuardedOracle`, but nothing pays yet. Demo 1 is the
talk's only live-only demo (Q2). Success: an agent with an ERC-8004 identity gets a `402`, passes its budget, signs
Permit2, gets a `200` in real ARGt on the fork, and rates the seller; `pnpm demo1` prints it with balances.

## Scope

### In Scope

- T5.1 to T5.10, every Done-when box.
- Prerequisites: config and guard deltas, `--scripted` mode, throwaway fork keystores.

### Out of Scope

- Custom contracts (Q4), mainnet transactions (C1), imported mainnet keys (Q20).
- `/demo-1` UI (M10), PayAI and x402-rs (T11.3), USDC and L1 profiles (M9), Demo 3 rating direction (O6).

## Capabilities

### New Capabilities

- `fork-environment`: T5.1, T5.2 registration script.
- `agent-identity`: T5.2 adapter.
- `x402-facilitator`: T5.3.
- `x402-seller-api`: T5.4.
- `x402-client`: T5.5.
- `budget-policy`: T5.6.
- `claude-llm`: T5.7.
- `agent-runner`: T5.8.
- `demo-1-buyer`: T5.9, T5.10.

### Modified Capabilities

- `config-profiles`: `ANTHROPIC_API_KEY` required only when Claude is selected; optional absolute `KEYSTORE_DIR`;
  `cchain-fork` records `forkBlock`.
- `chain-client`: guarded viem clients for SDK signers and anvil cheats, same 43114 loopback plus anvil rule.
- `core-domain-ports`: `run.started` names its LLM (`claude` or `scripted`).

## Approach and PR slicing

Stacked from `feature/pnpm-quote`; PRs target `develop`; 400 authored lines each, no `size:exception`.

| PR | Branch | Approach | Est. |
|---|---|---|---|
| 1 | `feature/demo-1-config` | Deltas above; `.demo1/` gitignored; catalog pins | 200 |
| 2 | `feature/demo-1-fork-scripts` | `demo1:fork` at pinned executed `N`, `--hardfork cancun`; creates role keystores and 0600 password files in `.demo1/` if absent | 320 |
| 3 | `feature/demo-1-fund` | `demo1:fund`: gas, mint by impersonating the adapter, bounded `approve(Permit2)`, asserts; idempotent | 280 |
| 4 | `feature/x402-facilitator` | Hono `x402Facilitator`, exact EVM on `eip155:43114`; SDK constants equal registry; fork settle test | 350 |
| 5 | `feature/x402-seller-api` | `@x402/hono`, `GuardedOracle` money parser, `maxTimeoutSeconds: 30`, rate source | 330 |
| 6 | `feature/x402-client` | Explicit two-request flow on `x402Client` and `x402HTTPClient` (`@x402/core`), allowance check, refuses amounts above `maxAmount`, events | 300 |
| 7 | `feature/erc8004-identity` | `Registered` agentId, verified `giveFeedback`, typed self-feedback error | 350 |
| 8 | `feature/budget-policy` | Profile caps, reason events | 150 |
| 9 | `feature/claude-llm` | `tool_choice: auto`, per-reply events, refusal, backoff | 300 |
| 10 | `feature/agent-runner` | Typed tools, max-steps guard | 250 |
| 11 | `feature/demo-1-buyer-agent` | Tools quote, buy, rate seller; shared scripted plan; `pnpm demo1` | 380 |
| 12 | `feature/demo-1-module` | `registerX402Module`, demos.md commands | 200 |
| 13 | `feature/e2e-demo-1` | Scripted LLM and fixed-rate oracle via DI; CI RPC cache by chain and block | 320 |

Auto-mode decisions:

- `pnpm demo1` uses Claude and fails fast naming `ANTHROPIC_API_KEY`; `--scripted` runs the E2E plan with zero
  secrets; chain and payment stay real.
- Keystores are generated throwaway keys (Q20); env-named keystores win.

## Affected Areas

| Area | Impact |
|---|---|
| `demos/01-x402-twin/`, `packages/agent-kit/`, `e2e/protocol/` | New |
| `packages/config/`, `packages/chains/`, `packages/core/src/domain/agent-event.ts` | Modified |
| `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`, CI, `docs/demos.md` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `@x402/*` 2.29.0 tarball drifts from Step 0 source | Med | Exact pins; x402 PRs early; constants asserted |
| SDK approves unlimited, or allowance missing | Med | Bounded approve; pre-sign check; typed error |
| Fork RPC limits; fork clock breaks deadlines (now + 6 s) | Med | Pinned `N`, RPC cache, time sync, PR 4 test |
| ERC-8004 self-feedback | Low | Separate seller key and identity |
| SDK signers bypass the guard | Med | Only guarded clients from `packages/chains` |
| `--scripted` read as a C1 mock | Med | Labeled LLM; stage use waits on O13 |

## Rollback Plan

One squash commit per PR; revert newest first. Fork state is disposable (`rm -rf .demo1`, restart anvil). Config
deltas are additive.

## Dependencies

- PR #62; anvil; a C-Chain RPC serving `N`.
- Decisions: Q2, Q4, Q5, Q11, Q12, Q16, Q17, Q20, C1, C3; O6, O13.

## Success Criteria

- [ ] `pnpm demo1 --scripted` prints the full sequence and balances with zero secrets.
- [ ] `pnpm demo1` with a key runs the same flow on Claude.
- [ ] E2E: `402` → `200`, ARGt moved equals the quote, feedback on the seller's `agentId`.
- [ ] No contract deployed; no write off loopback anvil; no raw keys.

## Proposal question round (pending review, auto mode)

1. Stage fallback (O13): assumed `--scripted` for dev, CI, and rehearsal only.
2. Rate trust: assumed the buyer caps ARGt at its own quote times the per-payment cap.
3. Feedback: assumed one positive score after a `200`; none on failure.
4. Funding: assumed mint twice the total budget; approve that, never `maxUint256`.
