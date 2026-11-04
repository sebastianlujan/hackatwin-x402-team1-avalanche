# Delta for Demo 1 Buyer

Base: demo-1 `demo-1-buyer` (not yet archived). Checked: "Module and runbook" (`registerX402Module` importable) and
"`pnpm demo1` with Claude" keep their text; the new run entry only adds an export and `pnpm demo1` output and exit codes
stay the same. The names below do not collide with any base requirement, so ADDED is used.

## ADDED Requirements

### Requirement: Run entry exported through module

`@hackatwin/demo-01-x402-twin/module` MUST export one run entry that composes the root, runs the preflight, runs the buyer
with a chosen `llm`, and reads balances before and after. `pnpm demo1` MUST call that same entry, and its output and
exit codes MUST NOT change. The entry MUST accept injected service URLs, an event sink, and preflight deps so tests need
no chain.

#### Scenario: CLI parity

- GIVEN a scripted run with fakes
- WHEN the CLI path and the module entry both run
- THEN both yield the same event sequence and the same exit code

#### Scenario: Preflight error

- GIVEN a failing preflight dep
- WHEN the entry runs
- THEN it throws `PreflightError` naming the fixing command before any write

#### Scenario: Claude without a key

- GIVEN `llm: claude` and no key
- WHEN the entry runs
- THEN it fails naming `ANTHROPIC_API_KEY` before any chain call

### Requirement: Absolute keystore directory under web

When the web server composes the root, `KEYSTORE_DIR` MUST be an absolute path or start MUST fail with a readable error.

#### Scenario: Relative dir

- GIVEN a relative `KEYSTORE_DIR`
- WHEN the web root composes
- THEN it fails naming the variable

## Traceability

| Done-when box | Requirement |
|---|---|
| (proposal) run entry exported through `module`, CLI reuses it | Run entry exported through module |
| (risk) bundling and `import.meta.dirname` | Absolute keystore directory under web |
