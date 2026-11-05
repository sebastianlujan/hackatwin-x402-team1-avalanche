---
title: 'ADR 0008: Scripted LLM mode for Demo 1'
---

# ADR 0008: Scripted LLM mode for Demo 1

## Status

Accepted, 2026-11-04 (M5, T5.8 to T5.10).

## Context

Demo 1 has no recorded fallback ([Q2](../decisions.md#decision-log)). CI, the protocol E2E, and rehearsals need a run
with zero secrets. Core's `ScriptedLLM` replays canned replies, ignores tool results, and is test-only (rule R5).
[C1](../decisions.md#cross-cutting-decisions) forbids mocks in demos, and stage use of a non-Claude run is open (O13).

## Decision

- `pnpm demo1 --scripted` selects `ScriptedPlanLLM` from `packages/agent-kit`: a deterministic `LLM` adapter that
  walks a plan of steps, each a function of the conversation so far. Demo 1's plan lives in the demo: quote, buy,
  then `rate_seller` only if the purchase returned 200.
- Everything else is the live path: the fork, real ARGt, Permit2, the facilitator, ERC-8004, the oracle, the runner,
  the tools, and the policy.
- `run.started` carries `llm: 'claude' | 'scripted'`; the CLI prints it on its first line, and scripted reasoning text
  starts with "Scripted plan:".
- `loadProfile(name, env, { llm })` requires `ANTHROPIC_API_KEY` only for `claude`.
- The protocol E2E runs the same plan. Stage use waits on O13; until then it is for development, CI, and rehearsal.

Rejected: core `ScriptedLLM` in a root (breaks R5, and canned replies cannot react to a failed purchase); a recorded
replay (ruled out by Q2); a manual trigger that skips the runner (a second code path that the live run never takes).

## Consequences

- Scripted and Claude runs share the runner, tools, policy, and event schema; recordings and the UI tell them apart
  by `llm`.
- A plan change touches one file in the demo.
- If O13 allows it, the stage fallback is the same command with `--scripted`.
