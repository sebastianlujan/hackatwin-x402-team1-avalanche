# Web Shell Specification

## Purpose

`apps/web` is a Next.js App Router app whose server root composes the demo modules and whose client side receives only
serialized data. Covers T10.2 (PRs 1 and 9).

## Requirements

### Requirement: Server-only composition root

The server root MUST be the only place that loads the profile, keystores, guarded fork clients, and demo modules. It
MUST be lazy: building the app MUST NOT need any environment variable, and the root MUST NOT run at import time.

#### Scenario: Build without environment

- GIVEN no env vars and no running services
- WHEN `pnpm --filter @hackatwin/web build` runs
- THEN the build succeeds and no keystore, RPC, or fork call is made

#### Scenario: Client file imports the root

- GIVEN a file with a `use client` directive
- WHEN it imports the root, `server-only` code, `@hackatwin/config`, the keystore, or a demo package
- THEN the build or the dependency-rule check fails

### Requirement: Secrets never reach the client bundle

The app MUST NOT ship any secret in `.next/static`. This includes `ANTHROPIC_API_KEY`, keystore names and password
file paths, and the fork RPC URL. Guarded clients and cheats MUST stay in the server root (ADR 0007).

#### Scenario: Static scan

- GIVEN a build made with sentinel secret values in the environment
- WHEN the CI scan greps `.next/static` for each sentinel value and for `ANTHROPIC_API_KEY`, `KEYSTORE`, and `anvil_`
- THEN no match is found, and a planted sentinel makes the scan fail

#### Scenario: Fork guard stays server side

- GIVEN a browser session on `/demo-1`
- WHEN any response body, SSE frame, or client chunk is inspected
- THEN none carries the fork RPC URL, a cheat method name, or an account key

### Requirement: Presentational components are pure

Presentational components (files under `packages/ui/src/**` and `apps/web/src/components/**`) MUST import no React hooks,
no `wagmi`, no `@tanstack/react-query`, and no `@hackatwin/core` ports. Containers pass data and callbacks as props.

#### Scenario: Hook import

- GIVEN a presentational file that imports `useState` or `useAccount`
- WHEN the dependency-rule check runs
- THEN it reports R10 for that file

#### Scenario: Server markup

- GIVEN a presentational component and props
- WHEN rendered with `react-dom/server`
- THEN the markup renders with no provider, context, or port available

### Requirement: Wallet provider knows only Fuji

The client wallet provider MUST be configured with Fuji (chain 43113) and injected (EIP-1193) connectors only. It MUST
NOT list 43114, the fork, or WalletConnect.

#### Scenario: Provider config

- GIVEN the wallet provider config
- WHEN its chains and connectors are listed
- THEN chains equals `[43113]` and every connector is injected

### Requirement: The app builds in CI

`ci-gate` MUST include a `web-build` job that builds the app and runs the static secret scan; a failure MUST block the gate.

#### Scenario: Gate wiring

- GIVEN the CI workflow file
- WHEN its jobs are read
- THEN `web-build` exists and `ci-gate` lists it in `needs`

## Traceability

| Done-when box | Requirement |
|---|---|
| Presentational components import no hooks or ports (lint rule) | Presentational components are pure |
| Secrets never reach the client bundle | Server-only composition root; Secrets never reach the client bundle |
| The app builds in CI | The app builds in CI |
| (proposal) wagmi knows only Fuji | Wallet provider knows only Fuji |
