# Design Tokens Specification

## Purpose

Shared CSS variables and props-only atoms in `packages/ui` for web and docs. Covers T10.1 (PR 4).

## Requirements

### Requirement: Tokens are CSS variables

Color, type, spacing, and radius tokens MUST be CSS variables in one source file, read by `apps/web` and the docs
theme. The palette is near-black background, cream text, and one orange accent. A same-hue darker variant `--hk-accent-ink` MUST exist and MUST be used only where the accent
sits on a light background (docs light mode), so that use keeps 4.5:1; it is not a second accent. No component or theme
MAY hardcode a palette value outside that file. Text MUST be monospace-first. Pure `#000000` MUST NOT be used.

#### Scenario: Single source

- GIVEN the web and docs stylesheets
- WHEN scanned for hex or rgb color literals
- THEN none exist outside the tokens file

#### Scenario: Contrast

- GIVEN the cream text on the background token and the accent on the background token
- WHEN contrast is computed
- THEN each is at least 4.5:1

#### Scenario: Accent ink on light

- GIVEN the docs light mode background
- WHEN `--hk-accent-ink` on that background is computed, and `--hk-accent` on it is searched for in docs light styles
- THEN the ink contrast is at least 4.5:1, the ink shares the accent hue, and the plain accent is not used as text there

### Requirement: Atoms take props only

Button, Badge, Cursor (`> HACKATWIN_`), TxLink, and CodeTag MUST take props only and obey R10. Interactive atoms MUST
show a visible focus state, and the Cursor blink MUST stop under `prefers-reduced-motion`.

#### Scenario: Render without context

- GIVEN each atom and its props
- WHEN rendered with `react-dom/server`
- THEN markup renders with no provider

#### Scenario: Reduced motion

- GIVEN the Cursor stylesheet
- WHEN `prefers-reduced-motion: reduce` applies
- THEN no animation is declared for it

### Requirement: TxLink shows a link only with a URL

TxLink MUST render an anchor (`rel="noopener noreferrer"`, new tab) when given a URL and a plain monospace hash when it has none.

#### Scenario: No URL

- GIVEN a hash and no URL
- WHEN TxLink renders
- THEN the output has no `<a>` and shows the hash

#### Scenario: With URL

- GIVEN a hash and a URL
- WHEN TxLink renders
- THEN one anchor points to the URL

### Requirement: Marks are text until O4

Logos MUST NOT ship before O4 is approved. Twin, team1, and Avalanche appear as text marks or labeled placeholders;
Avalanche appears only as a "Built on Avalanche" text link.

#### Scenario: No image assets

- GIVEN the built app and docs
- WHEN the asset list is read
- THEN no logo image or SVG of Twin, team1, or Avalanche exists

### Requirement: Docs theme reads the tokens

(docs-site) The docs theme MUST import the shared tokens, and the docs build MUST still pass.

#### Scenario: Docs build

- GIVEN the docs theme importing the tokens
- WHEN `apps/docs` builds
- THEN it succeeds and the theme defines no palette literal of its own

## Traceability

| Done-when box | Requirement |
|---|---|
| Tokens are CSS variables used by web and the docs theme | Tokens are CSS variables; Docs theme reads the tokens |
| Atoms take props only | Atoms take props only; TxLink shows a link only with a URL |
| Logos are added only after O4 | Marks are text until O4 |
