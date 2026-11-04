# Delta for docs-site

## ADDED Requirements

### Requirement: Docusaurus reads docs in place

`apps/docs` MUST build with `docs.path: '../../docs'`. No file MAY be copied out of `docs/`.

#### Scenario: Build succeeds

- Given a clean install
- When `pnpm --filter docs build` runs
- Then it exits 0 and the output has a page for `PLAN`

#### Scenario: No copies

- Given the T1.3 branch
- When the tree is searched for duplicates of `docs/*.md` outside `docs/`
- Then none are found

### Requirement: Broken links fail the build

The config MUST set `onBrokenLinks: 'throw'` and `markdown.format: 'detect'`; existing broken links MUST be fixed in
place.

#### Scenario: Broken link detected

- Given a `docs/` file linking to a missing target
- When the docs build runs
- Then it exits non-zero and names the link

### Requirement: Diagrams render

Mermaid blocks and Excalidraw SVGs in `docs/` MUST render in the built site.

#### Scenario: Mermaid and SVG

- Given a `mermaid` block and an Excalidraw SVG reference in `docs/`
- When the built page is opened
- Then the diagram renders and the SVG loads, with no raw source shown

### Requirement: Pages deploy from main

A workflow MUST deploy the site to GitHub Pages on push to `main` and on `workflow_dispatch`, using OIDC with
`pages: write` and `id-token: write` only on the deploy job.

#### Scenario: Merge to main publishes

- Given a merge to `main`
- When the deploy workflow runs
- Then the Pages URL serves `PLAN`

#### Scenario: Idempotent re-run

- Given a successful deploy
- When the workflow is re-run on the same commit
- Then it succeeds and the site is unchanged

#### Scenario: No deploy from PRs

- Given a pull request
- When CI runs
- Then the deploy job does not run

### Requirement: PR site artifact

PRs that touch docs or `apps/docs` MUST upload the built site as an artifact.

#### Scenario: Artifact attached

- Given a PR changing `docs/PLAN.md`
- When CI completes
- Then a downloadable site artifact is attached to the run

### Requirement: Pages setup documented

`CONTRIBUTING.md` MUST describe enabling Pages and allowing `main` in the `github-pages` environment.

#### Scenario: Documented

- Given `CONTRIBUTING.md`
- When searched for "github-pages"
- Then the enable command and branch rule are described

## Traceability

| PLAN checkbox | Requirement |
|---|---|
| T1.3 build passes with `onBrokenLinks: 'throw'` | Broken links fail the build; Docusaurus reads docs in place |
| T1.3 Excalidraw SVGs and Mermaid render | Diagrams render |
| T1.3 No file copied out of `docs/` | Docusaurus reads docs in place (No copies) |
| T1.6 A merge to `main` publishes the site | Pages deploy from main |
| T1.6 Re-running the deploy is idempotent | Pages deploy from main (Idempotent re-run) |
| T1.6 PRs attach the built site | PR site artifact |
