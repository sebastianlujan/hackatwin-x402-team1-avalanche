# DI Container Specification

## Purpose

A hand-rolled typed container in `@hackatwin/core` with scopes, overrides, and disposal.

## Requirements

### Requirement: Typed tokens and resolution

The container MUST register and resolve services by typed token. Resolving an unregistered token MUST throw an error naming the token.

#### Scenario: Resolve

- GIVEN a token registered with a factory
- WHEN it is resolved
- THEN the typed value is returned

#### Scenario: Missing token

- GIVEN no registration
- WHEN the token is resolved
- THEN an error names the token

### Requirement: Scopes

Singleton registrations MUST build once per container; transient registrations MUST build on every resolve.

#### Scenario: Scope behavior

- GIVEN one singleton and one transient token
- WHEN each is resolved twice
- THEN the singleton returns the same instance and the transient two different ones

### Requirement: Cycle detection

A circular dependency MUST fail with an error containing the full token path (for example `A -> B -> A`).

#### Scenario: Cycle

- GIVEN A depends on B and B on A
- WHEN A is resolved
- THEN the error contains `A -> B -> A`

### Requirement: Child overrides

`child()` MUST return a container that inherits registrations and lets overrides replace a token without changing the parent. A child MUST NOT reuse a parent singleton for an overridden token or its dependents.

#### Scenario: Swap adapter for fake

- GIVEN a service built on a real adapter in the parent
- WHEN a child overrides the adapter token with a fake and resolves the service
- THEN the service uses the fake and the parent still uses the real adapter

### Requirement: Disposal

Disposing a container MUST dispose its created singletons in reverse creation order, each once. A child's dispose MUST NOT dispose parent singletons. A failing disposer MUST NOT stop later disposers; errors are aggregated and thrown.

#### Scenario: Reverse order

- GIVEN singletons A, B, C created in that order
- WHEN the container is disposed
- THEN disposers run C, B, A

#### Scenario: Disposer failure

- GIVEN B's disposer throws
- WHEN the container is disposed
- THEN A still disposes and an aggregated error is thrown

### Requirement: Branch coverage

The container's tests MUST cover every branch (coverage threshold 100 percent branches for the container module).

#### Scenario: Coverage gate

- GIVEN the container tests run with coverage
- WHEN a branch is untested
- THEN the run fails

## Traceability

| Done-when | Requirement |
|---|---|
| T3.2 a cycle fails with the token path | Cycle detection |
| T3.2 reverse-order disposal | Disposal |
| T3.2 tests cover every branch | Branch coverage |
| M3 demo: swap through `child()` | Child overrides |
