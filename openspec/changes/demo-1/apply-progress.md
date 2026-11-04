# Apply progress: demo-1 (M5), batches 1 and 2 (PRs 1 to 7)

Mode: Standard (strict TDD does not apply). Chain: stacked, every PR targets `develop`, review budget 400 authored lines (lockfile excluded). No `size:exception`.

## Completed tasks

- [x] 1.1, 1.2, 1.3 (PR 1). ADR 0008 deliberately left out (belongs to the scripted-LLM PR).
- [x] 2.1, 2.2, 2.3 (PR 2a). `cheats()` split into the next PR to stay under 400.
- [x] 2.4, 2.5, 2.6 (PR 2b, split into three PRs).
- [x] 3.1, 3.2, 3.3 (PR 3, split into two PRs).

- [x] 4.1, 4.2 (PR 4a #79), 4.3 (PR 4b #80): PR 4 split into two.
- [x] 5.1, 5.2 (PR 5 #82).
- [x] 6.1, 6.2 (PR 6a #85 engine, PR 6b #86 gateway): PR 6 split into two.
- [x] 7.1 to 7.4 (PR 7a #88 adapter, PR 7b #90 register script and fork test): PR 7 split into two.

## PRs (all base `develop`, stacked in this order)

| Seq | PR | Branch | Issue | Authored lines | Scope |
|---|---|---|---|---|---|
| 1 | #64 | `feature/demo-1-config` | #63 | about 170 | `{ llm }`, `KEYSTORE_DIR`, `CCHAIN_FORK_BLOCK`, `run.started.llm`, catalog pins |
| 2 | #66 | `feature/guarded-sdk-clients` | #65 | 382 | `createGuardedClients` (public, wallet, chainClient), R9, ADR 0007 |
| 3 | #68 | `feature/demo-1-anvil` | #67 | 272 | `cheats()`, `anvilArgs`, `startAnvil` |
| 4 | #70 | `feature/demo-1-keystores` | #69 | 200 | `encryptKeystore`, `state.ts`, `keystoreNamedInEnv` |
| 5 | #72 | `feature/demo-1-fork-scripts` | #71 | 235 | `pnpm demo1:fork`, `demo1:fork-block`, `fork` Vitest project, CI `fork` job |
| 6 | #75 | `feature/demo-1-funding` | #74 | 295 | `fund`, `createFundingChain`, `fileState`, demo env RPC defaults |
| 7 | #76 | `feature/demo-1-fund` | #73 | 282 | `module.ts`, `tokens.ts`, `pnpm demo1:fund`, fork test, `cacheTime: 0` fix |
| 8 | #79 | `feature/x402-facilitator` | #77 | 333 | facilitator app, `assertSdkAddresses`, `serveLoopback`, `FacilitatorApp` token |
| 9 | #80 | `feature/x402-facilitator-service` | #78 | 230 | `composeRoot`, `pnpm demo1:facilitator`, live settle and expired-deadline fork test |
| 10 | #82 | `feature/x402-seller-api` | #81 | 263 | `createSellerApp`, `createArgtMoneyParser`, `pnpm demo1:seller` |
| 11 | #85 | `feature/x402-engine` | #84 | 140 | `X402Engine`, typed errors, `@x402/*` deps in agent-kit |
| 12 | #86 | `feature/x402-client` | #83 | 360 | `X402PaymentGateway`, `usdAtRate` |
| 13 | #88 | `feature/erc8004-identity` | #87 | 313 | `Erc8004Identity`, ABI subset, `viem` dep |
| 14 | #90 | `feature/erc8004-registration` | #89 | 334 | `registerRoles`, `pnpm demo1:register`, live feedback fork test |

Batch 1 (seven PRs): CI green, including the `fork` job. Batch 2 (seven PRs #79, #80, #82, #85, #86, #88, #90): CI green, including `fork`.

## Work Unit Evidence (per PR)

| Evidence | Value |
|---|---|
| Focused tests | `pnpm vitest run packages/config packages/core` (118), `packages/chains test/dependency-rule`, `packages/chains` (53/56/...), `demos/01-x402-twin` (11 to 22); `pnpm test` ends at 263 tests green, `pnpm lint` clean, `pnpm typecheck` clean |
| Runtime harness | `pnpm test:fork` 5 tests green; live `pnpm demo1:fork` (anvil at 99388000, chain 43114, rerun no-op), `pnpm demo1:fund` twice (below) |
| Rollback boundary | per PR, see each PR body |

## Live fork funding evidence (fresh anvil at block 99388000, loopback only)

- Run 1: gas topped up for 4 addresses; minted 16583.645864138479263121 ARGt; approved the same amount.
- Run 2: gas topped up for 0; minted 0; allowance already set.
- `cast`: agent ARGt `balanceOf` = 16583645864138479263121; `allowance(agent, Permit2)` = 16583645864138479263121 (equals T); gas about 10 AVAX for agent, seller, facilitator, adapter.
- Roles: agent 0x7Ea1e5EF86548a506C81085099b356fD0B7B9EFC, seller 0xf4dD0BabCc0ea3A9680038C1819ebcA8e8F585B5, facilitator 0x32cA50A7e70e0894BF557F6E8fB934e89A0Ac164 (throwaway keystores in gitignored `.demo1/`).

## Deviations from design

- PR 2 became four PRs (2a, anvil, keystores, fork scripts) and PR 3 two (funding, module and script) to stay under 400 lines; `cheats()` lives in the anvil PR, not 2a.
- `N` (`CCHAIN_FORK_BLOCK`) = 99_388_000; the public RPC serves it.
- `demo1.env` also writes the three public read RPC defaults (the `cchain-fork` profile requires them).
- `keystoreNamedInEnv` added to the config loader so scripts never read `process.env` (R6).
- Role keystores that env names keep the user's; our own `demo1.env` entries are kept on rerun when the file exists.
- Bug fixed in PR 3b: viem cached head made reads after writes stale; `getBlockNumber({ cacheTime: 0 })`.
- Tokens for Registration, FacilitatorApp, SellerApp, Buyer, Balances are typed `unknown` until their PR.

## Batch 2 evidence (live local fork at 99388000, loopback only, throwaway keys)

- Facilitator service (real HTTP, `pnpm demo1:facilitator`): verify `isValid: true`, settle tx `0xda5cc69a2141033036f09d2feed1ac17a8c2cc108fdc1c2f357c6f37f01748cf`; agent ARGt 16583645864138479263121 to 16582645864138479263121, seller 0 to 1000000000000000000 (1 ARGt).
- Seller 402 to 200 (real oracle on Arbitrum and Base): 402 amount 16583659286758589132, settle tx `0x22595c5c8765a9fc6ccdc7686029680edda9ed6bead120f9cbd39a0513aeec6c`; seller 1 ARGt to 17.583659286758589132 ARGt.
- Gateway (real engine): events payment.required, payment.signed, payment.status, resource.received; a ceiling of 10 ARGt gave `AboveMaxAmountError` with `policy.decision` `above_max_amount` and the seller balance unchanged.
- ERC-8004: `pnpm demo1:register` printed agentId 1852 and 1853, rerun printed the same with the block number unchanged (99388011); feedback tx `0x25ff488a79e845c587923d3ceb983f78df5be0a1f132439da34790c486ce6445`, reputation count 1; self-feedback `SelfFeedbackError`, registry reverts when the guard is bypassed.

## Findings

- `extra.quote` (Open Question, PR 5): a custom `extra.quote` DOES reach the 402, in the `PAYMENT-REQUIRED` header `accepts[0].extra.quote`; the body is `{"error":"Payment required"}`. The paid request is priced again and the client's `accepted.extra` must contain the advertised one, so `extra.quote` carries no expiry; the oracle freeze keeps the amount stable. No route-description fallback needed.
- `@x402/hono` catches parser errors and answers its own 500, so an oracle error reaches 503 only through a wrapper that flags the failure (`AsyncLocalStorage`).
- `x402Client` default `spendControls` reject non-default assets such as ARGt; the engine and the fork test turn them off, the gateway ceiling replaces them.
- A 402 `extensions` entry (`erc20ApprovalGasSponsoring`, `eip2612GasSponsoring`) could make the signer sign an approval transaction; the gateway rejects them and the engine drops server extensions.
- ERC-8004 v2.0.0 signatures (Open Question, PR 7), verified against `erc-8004/erc-8004-contracts` and the deployed fork: `giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)`, `getClients(uint256) returns (address[])`, `getSummary(uint256,address[],string,string) returns (uint64,int128,uint8)` (reverts without clients), `register(string)`, `Registered(uint256 indexed agentId, string agentURI, address indexed owner)`, `isAuthorizedOrOwner(address,uint256)` (the reputation registry reverts with "Self-feedback not allowed" on it, so the adapter uses it as the pre-check).
- `register(string)` is one of three overloads; the ABI subset lists only that one.
- Environment: this run pushed over HTTPS with the `gh` credential helper (SSH was denied in the sandbox); a transient GitHub 500 needed a retry loop. `git commit` needs `~/.nvm/versions/node/v26.13.0/bin` on PATH (husky runs pnpm).

## Deviations from design

- PR 4 became two PRs (app plus address check; service plus fork test) and PR 6 two (engine; gateway), PR 7 two (adapter; script and fork test) to stay under 400 lines.
- `composeRoot` (`root.ts`) was added in PR 4b so facilitator, seller and fund share one start; `ports.ts` holds 4020 and 4021.
- `Erc8004Identity` pre-checks with the registry's `isAuthorizedOrOwner` instead of `ownerOf` plus approvals (the same check the registry reverts on).
- The gateway throws typed errors (`AboveMaxAmountError`, `AllowanceShortfallError`, `PaymentDeniedError`, `PaymentRequirementsError`) for refusals; it returns a `PaidResponse` only for paid or non-402 answers. Its `usdValue` option carries the buyer's rate (`usdAtRate`).
- Tokens `FacilitatorApp`, `SellerApp`, `Registration` now have real types; `Buyer` and `Balances` stay `unknown`.

## Remaining

Tasks 8.1 onward (PRs 8 to 13). ADR 0008 and its README row are uncommitted in the working tree, for the scripted-LLM PR.
