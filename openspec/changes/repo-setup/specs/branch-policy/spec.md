# Delta for branch-policy

## ADDED Requirements

### Requirement: Rulesets as code

`.github/rulesets/` MUST hold JSON for rulesets 26496788 and 26496789 (`main` and `develop`) matching the live
policy. The only required status check MUST be `ci-gate`.

#### Scenario: No drift from live

- Given the committed JSON and the live rulesets exported with `gh api`
- When diffed
- Then there is no semantic difference

#### Scenario: Required check

- Given the ruleset JSON
- When `required_status_checks` is read
- Then it lists only `ci-gate`

### Requirement: PRs need green checks, no force push or deletion

Both rulesets MUST require a pull request and green `ci-gate`, and MUST block force pushes and deletions.

#### Scenario: Rules present

- Given the ruleset JSON
- When rules are read
- Then `pull_request`, `required_status_checks`, `non_fast_forward`, and `deletion` rules are present

#### Scenario: Red check blocks merge

- Given a PR with a failing `ci-gate`
- When merge is attempted
- Then GitHub blocks it

### Requirement: Direct pushes rejected

Pushes directly to `main` and `develop` MUST be rejected.

#### Scenario: Direct push to develop

- Given a local commit on `develop`
- When `git push origin develop` runs
- Then the push is rejected by the ruleset

#### Scenario: Direct push to main

- Given a local commit on `main`
- When `git push origin main` runs
- Then the push is rejected by the ruleset

### Requirement: Apply command documented

`CONTRIBUTING.md` MUST document the `gh api` commands to export and apply each ruleset JSON. The live policy MUST
NOT change.

#### Scenario: Documented

- Given `CONTRIBUTING.md`
- When searched for "rulesets"
- Then the apply and export commands for both rulesets are shown

### Requirement: CODEOWNERS

`.github/CODEOWNERS` MUST exist with a default owner rule and no syntax errors.

#### Scenario: Valid file

- Given `.github/CODEOWNERS`
- When validated through the GitHub `codeowners/errors` API
- Then the error list is empty

## Traceability

| PLAN T1.5 checkbox | Requirement |
|---|---|
| PRs require green checks; force pushes and deletions blocked | Rulesets as code; PRs need green checks, no force push or deletion |
| A direct push to `develop` is rejected | Direct pushes rejected |
| The apply command is documented in `CONTRIBUTING.md` | Apply command documented |
