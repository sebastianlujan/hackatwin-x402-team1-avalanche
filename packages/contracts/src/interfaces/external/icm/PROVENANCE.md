# Provenance

These files are original MIT interfaces. They declare only the ICTT surface this project calls
(`receiveTokens`, `sendAndCall` and the `SendAndCallInput` struct), written from the documented ABI.
No upstream source is copied, so no upstream license file is included.

ABI reference: <https://github.com/ava-labs/icm-services>, commit `34deb30f7ddb4e6fecfd1132b413d09570610851`
(`icm-contracts/avalanche/ictt/interfaces`, 2026-10-30).

`test/unit/IcmInterfaces.t.sol` pins the selectors and the struct layout, so any drift from the ABI fails.
Open question O7 (human sign-off) is tracked in `docs/decisions.md`.
