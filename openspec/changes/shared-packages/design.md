# Design: Shared packages (M4)

## Technical Approach

`pricing/src` sees only core ports; `chains` owns viem, the registry, and the keystore. Two secret-free roots wire them and run with zero config: `packages/chains/scripts/verify.ts` (`pnpm chains:verify`) and `packages/pricing/scripts/quote.ts` (`pnpm quote`). PRs follow the proposal table.

## Architecture Decisions

| ID | Choice | Rejected |
|---|---|---|
| D1 Port (ADR 0006) | `read(call, { blockNumber? })` returns `{ value, blockNumber }`; new `blockNumber()`; the adapter pins unpinned reads to the head | Blocks tracked only in oracles |
| D2 Fake | Reads scripted by `address:fn(args)`, bigint-safe; `Error` values reject; `calls` records each requested block; misses name address, function, args | Name-only map |
| D3 Registry | Per-chain JSON, zod-validated at import, `source` per entry (`https://` or `read: `). `listChains()` returns six entries; `chain(key)` throws `ChainError` naming an unknown key; `toViemChain(key)` throws for the planned L1 | TS constants (Foundry and T7.10 need JSON) |
| D4 RPC loader | `loadRpcUrls(needed, env = process.env)` in `load-profile.ts`; `needed` maps registry keys to `rpc.public` or `undefined`. Each key reads `<KEY>_RPC_URL` (key uppercased, `-` to `_`): `CCHAIN_RPC_URL`, `FUJI_RPC_URL`, `SEPOLIA_RPC_URL`, `TWINPAY_L1_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`. Env wins, else the default. A needed key with neither, or an invalid URL, throws `ConfigError` naming the variable, never the value | Config importing chains; defaults in config |
| D5 Writes | Async `createChainClient({ chain, rpcUrl, account? })` asserts `eth_chainId`, then fixes the policy once: `read-only` access and IDs 42161, 8453 never write; 43114 writes only through `CCHAIN_FORK_RPC_URL` (loopback per the `cchain-fork` profile) with `anvil` in `web3_clientVersion`; `CCHAIN_RPC_URL` stays read-only | Per-call checks; JSON alone |
| D6 Keystore | Web3 Secret Storage v3 on `node:crypto` (scrypt, pbkdf2, AES-128-CTR), viem `keccak256` MAC, `timingSafeEqual`; a MAC mismatch throws `KeystoreError` naming the keystore, never the password. `loadKeystoreAccount(name, passwordFile)` lives in subpath `@hackatwin/chains/keystore`; rule R7 bans it in `packages/*` | ethers, `@noble/ciphers` |
| D7 Units | `RateReading { source, argtPerUsd (ARGt, 18 decimals), chainId, blockNumber }`; `Quote.rate` stays USD per ARGt (36 decimals); `amount` via `convertMoney` | New core math |
| D8 Curve | One block: `coins(0)`, `coins(1)` must equal registry `argt`, `usdt0`; `price_oracle()`, no args, 18 decimals; USD₮0 = 1 USD | `symbol()` only |
| D9 Chainlink | One Base block: `decimals()`, `latestRoundData()`, sequencer through the V2V3 ABI. Reject answer <= 0, `updatedAt` 0 or older than `heartbeatSeconds` (86400 from the registry), sequencer answer != 0, `startedAt` 0 or under 3600 s (exactly 3600 s passes, per spec). Rate `10^(d+18) / answer`; 1 ARS = 1 ARGt; no `answeredInRound`; injected `now` | Block-timestamp clock |
| D10 Guard | Curve iff `abs(c - l) * 10000 <= 200 * l`, else Chainlink with `guarded: true`; any source error throws. `reading()` returns `{ chosen, curve, chainlink, deltaBps, guarded, validUntil }`; `createGuardedOracle({ arbitrum, base, addresses, now })` is the one wiring for roots and M5 | Unguarded Curve fallback |
| D11 Freeze | Per-asset in-flight promise reused while `now < validUntil` (30 s, internal ms); errors evicted; USDC throws until M9; M5 maps the window to x402 `maxTimeoutSeconds: 30` | Per price |
| D12 Output | `quote-line.ts` in pricing: `formatQuoteLine` prints `1 USD = <x> ARGt (Curve, block N) \| Chainlink <y> \| Δ <z>% ✓` or `1 USD = <y> ARGt (Chainlink, guarded) \| Curve <x> (block N) \| Δ <z>% ⚠` (rates half-up to 1 decimal, absolute Δ to 2); `runQuote(oracle, io)` prints the line or the error and returns the exit code. The script only wires and sets `process.exitCode` | Logic in the root |
| D13 viem | `2.57.16`, exact, in the catalog; `http(url, { batch: true, retryCount: 3 })`; `viem/chains` by chain ID. PR 3 typechecks on TypeScript 7.0.2 first; on failure chains and pricing pin TS 5.x (ADR 0005) | Ranges |
| D14 Boundaries | `*.nightly.test.ts` in a `nightly` Vitest project outside `pnpm test`; rule R8: `pricing/src` imports only core | Env flags (R6) |

## Data Flow

    loadRpcUrls ─→ createChainClient(arbitrum) ─→ CurvePoolOracle ─────┐
    registry    ─→ createChainClient(base)     ─→ ChainlinkFeedOracle ─┤
                         createGuardedOracle ─→ GuardedOracle (band, freeze)
                            runQuote ─→ formatQuoteLine ─→ stdout
                            quote()  ─→ M5 seller API

## Registry

`packages/chains/registry/{cchain,fuji,sepolia,twinpay-l1,arbitrum,base}.json`. The `cchain` file (43114) serves the fork, which keeps C-Chain addresses.

```json
{
  "key": "arbitrum", "name": "Arbitrum One", "status": "live",
  "chainId": 42161, "access": "read-only",
  "rpc": { "public": "https://arb1.arbitrum.io/rpc" },
  "contracts": {
    "argt": {
      "address": "0x59863989d080B22476DB95656d0C3CC18be92214",
      "source": "read: coins(0) of curveArgtUsdt0Pool, 2026-11-04",
      "checks": [{ "call": "function symbol() view returns (string)", "expect": "ARGt" }]
    }
  }
}
```

- `status: planned` (TwinPay L1) omits `chainId` and `rpc`, has `contracts: {}`; lookups return `undefined`.
- `access`: `read-only` (Arbitrum, Base), `fork-only` (43114), `read-write` (testnets).
- `checks`: string `args` and `expect`; `@name` cites a sibling; no `expect` means the call succeeds. Base `arsUsdFeed` has `heartbeatSeconds: 86400`; Fuji and Sepolia add `ccip.chainSelector` as a string.
- Entries: C-Chain ARGt, Twin adapter, Permit2, x402 proxy, ERC-8004; Fuji USDC, Permit2, x402 proxy, ERC-8004, CCIP router, LINK, Teleporter, TeleporterRegistry; Sepolia router, LINK; Arbitrum pool, ARGt, USD₮0; Base ARS/USD, sequencer.

`verifyRegistry(chains, connect)` reads code size (adapter-only `codeSize`) and `checks` at one block per live chain. A rejected `connect`, `blockNumber`, or read marks every affected entry `FAIL <chain> <name> <address>`; the planned L1 prints `SKIP`. Output never shows the RPC URL; the exit code is 1 after all entries if any failed.

## Interfaces

```ts
export interface ReadOptions { readonly blockNumber?: bigint }
export interface ReadResult<T> { readonly value: T; readonly blockNumber: bigint }
export interface ChainClient {
  readonly chainId: number;
  blockNumber(): Promise<bigint>;
  read<T>(call: ContractCall, options?: ReadOptions): Promise<ReadResult<T>>;
  write(call: ContractCall): Promise<Hex>;
  waitForReceipt(txHash: Hex): Promise<Receipt>;
}
```

## Spec Deltas

These replace the named scenarios; sdd-verify checks against the replaced text.

| ID | Spec, scenario | Replaced by |
|---|---|---|
| SD1 | chain-registry, "Six chains load" | Exactly six chains load; the five live ones each have a chain ID and a viem chain object; the planned TwinPay L1 has neither until T6.1, and `toViemChain('twinpay-l1')` throws naming the key |
| SD2 | config-profiles, "Read-only RPC loader" and "Missing RPC" | The loader covers every live registry chain, not only Arbitrum and Base, with registry defaults, so "No secrets needed" also passes with an empty env. Missing RPC: GIVEN a needed chain with neither an env value nor a registry default (`twinpay-l1` until T6.1) WHEN it runs THEN one error names `TWINPAY_L1_RPC_URL` |
| SD3 | config-profiles, "Env coverage" | `.env.example` lists every variable with an empty value; each RPC variable has a comment line above it with its registry default |

## Scenario Coverage

Each source file ships with its `*.test.ts`.

| Scenarios | Element | Test |
|---|---|---|
| Six chains (SD1), unknown chain, checksum, unverified, promoted, L1 not deployed, heartbeat 86400 | D3, registry | `chains/src/registry.test.ts` (scans decisions.md Verified facts) |
| Pinned, unpinned, requested block, same function different args, unscripted | D1, D2 | `core/src/testing/fakes.test.ts`, `ports/ports.test.ts`, `chains/src/chain-client.test.ts` |
| Write on Base, public RPC, loopback not anvil, local anvil | D5 | `chains/src/write-guard.test.ts`, `chain-client.test.ts` (`custom()` transport sees no send) |
| Test vector, wrong password not echoed, import boundary | D6, R7 | `chains/src/keystore/keystore.test.ts`, `test/dependency-rule.test.ts` |
| All healthy, L1 skipped, missing contract, one of many, RPC down | `verifyRegistry` | `chains/src/verify-registry.test.ts` |
| No secrets, missing RPC (SD2), invalid URL | D4 | `config/src/load-profile.test.ts` |
| Env coverage (SD3), single reader (R6) | `.env.example`, R6 | `config/src/env-example.test.ts`, `test/dependency-rule.test.ts` |
| Curve happy, wrong coins | D8 | `pricing/src/curve-pool-oracle.test.ts` |
| Fresh, stale, sequencer down, grace 3599/3600 s, `startedAt` 0, answer <= 0 | D9 | `pricing/src/chainlink-feed-oracle.test.ts` |
| Exactly +2% and -2%, one unit beyond on both sides, freeze 29/30 s | D10, D11 | `pricing/src/guarded-oracle.test.ts` |
| Normal line, guarded line, failure exit | D12 | `pricing/src/quote-line.test.ts` |
| Reuse | Root imports `createGuardedOracle` and `GuardedOracle` from `@hackatwin/pricing` | `pricing/scripts/quote.test.ts` (source scan: those imports, no `10000`, `200`, or `bps`) |
| PR CI makes no RPC call; nightly | D14 | `vitest.config.ts` projects; `*.nightly.test.ts` |
| Docs | PR 9 | demos.md shows both lines, drops "script added during implementation", says `maxTimeoutSeconds`; so does Q12 |

## File Changes

| PR | Files |
|---|---|
| 1 | Core port, fake, `ports.test.ts`, `fakes.test.ts`; `config/src/load-profile.ts`, `env-example.test.ts`; `.env.example` comment lines; `docs/adr/0006-block-pinned-chain-reads.md` and README row |
| 2 | Six registry files, `chains/src/registry.ts`; four promotions in `docs/decisions.md` |
| 3 | `chains/src/chain-client.ts`, `write-guard.ts`; viem in `pnpm-workspace.yaml` |
| 4 | `chains/src/keystore/`; R7 in `test/dependency-rule.ts` |
| 5 | `chains/src/verify-registry.ts`, `chains/scripts/verify.ts`; root `chains:verify` |
| 6 | `pricing/src/curve-pool-oracle.ts`; Vitest projects; R8 |
| 7 | `pricing/src/chainlink-feed-oracle.ts`; decisions.md reference-rates row (Base tracks the market rate) |
| 8 | `pricing/src/guarded-oracle.ts`, `create-guarded-oracle.ts` |
| 9 | `pricing/src/quote-line.ts`, `pricing/scripts/quote.ts`; root `quote`; demos.md runbook; Q12 |
| 10 | `packages/contracts/script/ReadRegistry.s.sol`, after T7.1 |

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. D5 and D6 cover write and key risks.

## Migration / Rollout

No migration. The port change ships with its only implementers in PR 1.

## Open Questions

None. SD1 to SD3 record the spec reconciliations.

## Verified by the orchestrator (2026-11-04)

- viem pin: `2.57.16` (`npm view viem version`).
- Base feeds (read on-chain, addresses already EIP-55): ARS/USD `0xaf992a6ad37b4878cF9c31f082B178860e268cE3` ("ARS / USD", 8 decimals); sequencer `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` ("L2 Sequencer Uptime Status Feed", answer 0 = up, `startedAt` far in the past).
- Arbitrum Curve pool coins: `coins(0)` ARGt `0x59863989d080B22476DB95656d0C3CC18be92214`, `coins(1)` USD₮0 `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` (6 decimals).
