# Apply progress: shared-packages (M4)

Mode: standard (TypeScript, Q21), delivery SPLIT at pre-decided seams, stacked chain, every PR targets `develop`.
Batch 1 covers PRs 1 to 5 (tasks 1.1 to 5.2). Remaining: PRs 6 to 9 (tasks 6.1 to 9.3); PR 10 deferred.

## PRs

| PR | Branch | Issue | PR | Head | Authored lines | CI |
|---|---|---|---|---|---|---|
| 1 | `feature/chain-port-reads` | #45 | #46 | `7500306` | 232 | 10/10 pass |
| 2 | `feature/chain-registry` | #47 | #48 | `d824c10` | 398 (no 2a/2b split) | 10/10 pass |
| 3 | `feature/chain-client` | #49 | #50 | `d6fc949` | 294 | 10/10 pass |
| 4 | `feature/chain-keystore` | #51 | #52 | `45fd11c` | 216 | 10/10 pass |
| 5 | `feature/chain-registry-check` | #53 | #54 | `0db9804` | 241 | 10/10 pass |

Lines are additions plus deletions over the previous PR in the stack, `pnpm-lock.yaml` excluded.

## Completed tasks

- [x] 1.1 to 1.4 (port delta, arg-aware fake, `loadRpcUrls` and `.env.example` comments, ADR 0006 and README row)
- [x] 2.1 to 2.4 (four promotions, registry schema and loader, six JSON files, exports)
- [x] 3.1 to 3.3 (viem pin, write policy, adapter)
- [x] 4.1 to 4.2 (keystore, rule R7)
- [x] 5.1 to 5.2 (`verifyRegistry`, `chains:verify`)

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|---|---|---|---|
| PR 1 | `pnpm exec vitest run`: 116 passed | N/A, no runtime boundary (port and fake) | Revert the squash commit |
| PR 2 | `pnpm exec vitest run`: 125 passed (`registry.test.ts` 9) | `cast call` read-only checks on five chains confirmed every `checks` entry | `packages/chains/registry`, `registry.ts`, viem catalog entry, four `decisions.md` rows |
| PR 3 | `pnpm exec vitest run`: 145 passed | `custom()` transport records zero `eth_send*` on refused writes | `chain-client.ts`, `write-guard.ts`, exports |
| PR 4 | `pnpm exec vitest run`: 152 passed | pbkdf2 public vector and a `cast`-generated scrypt vector decrypt to the known key | `chains/src/keystore/`, `./keystore` export, R7 |
| PR 5 | `pnpm exec vitest run`: 161 passed | `pnpm chains:verify` live: 22 PASS, 1 SKIP, exit 0; unreachable Base: FAIL, exit 1, no URL | `verify-registry.ts`, `scripts/verify.ts`, `codeSize`, root script |

## Deviations and notes

- Task 3.1 moved into PR 2: `toViemChain` (task 2.2) needs viem, so the catalog entry `viem: 2.57.16` and the chains dependency land in PR 2. `pnpm typecheck` passes on TypeScript 7.0.2 with viem, so the TS 5.x fallback for `chains` and `pricing` is NOT used and ADR 0005 needs no note. Recorded in the PR 2 and PR 3 bodies.
- Task 4.1 vectors: the published scrypt vector (`n=262144, r=1`) is rejected by OpenSSL (`N` must be below `2^(16r)`), so `node:crypto` cannot decrypt it. The scrypt case uses a Foundry-generated keystore (`N=8192, r=8, p=1`) from the same public key; the published parameters are asserted as a clear `KeystoreError`. Consider a design note if a later task needs the published vector.
- Task 1.3: the existing "env coverage" test moved from `load-profile.test.ts` to the new `env-example.test.ts`; `.env.example` comments use `# default: <url>` (`# default: none (planned until T6.1)` for `TWINPAY_L1_RPC_URL`). Sepolia default is `https://ethereum-sepolia-rpc.publicnode.com` (chain ID verified).
- Task 5.2: the nightly `verify.nightly.test.ts` stub is deferred to PR 6 (it defines the `nightly` project), as the task allows. Root script runs `node packages/chains/scripts/verify.ts` (type stripping).
- Registry: ERC-8004 is two entries per chain (`erc8004Identity`, `erc8004Reputation`); C-Chain ARGt is the BeaconProxy `0x2E4e...703B`; Fuji TeleporterRegistry is `0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228` (read on Fuji: `getAddressFromVersion(1)` is the Teleporter messenger).
- `ChainsClient` (adapter return type) adds `codeSize`; the port is unchanged.
- Chainlink ARS/USD and the Base sequencer feed were re-checked on docs.chain.link and read on-chain; both cited in Verified facts.

## Remaining

- [ ] 6.1 to 6.3, 7.1 to 7.2, 8.1 to 8.3, 9.1 to 9.3 (PRs 6 to 9); 10.1 deferred.
