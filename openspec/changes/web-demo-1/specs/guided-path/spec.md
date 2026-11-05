# Guided Path Specification

## Purpose

The landing page and the talk screens in narrative order, with presenter keyboard navigation. Covers T10.3 (PRs 6 and 7).

## Requirements

### Requirement: Routes match PLAN section 7

One ordered list MUST define the path: `/`, `/path/avalanche`, `/path/first-tx`, `/path/identity`, `/demo-1`, `/demo-2`,
`/demo-3`, `/path/production`, `/path/built-by-agents`. Every route MUST resolve. `/demo-2` and `/demo-3` MUST render a
labeled placeholder until T10.7 and T10.8.

#### Scenario: Every route

- GIVEN the ordered list
- WHEN the app is built and each route's page file is checked
- THEN every route has a page file, the build succeeds, and none is missing from the list (HTTP 200 checks land with
  T10.10)

#### Scenario: Order

- GIVEN the list
- WHEN compared with the Screen column of section 7
- THEN the order and paths are identical

### Requirement: Presenter keyboard navigation

ArrowRight or PageDown MUST go to the next screen, ArrowLeft or PageUp to the previous, Home to the first. Keys MUST be
ignored with a modifier and while focus is in an input, textarea, select, or editable element. The ends MUST not wrap.
A key press MUST NOT start a run or send a transaction. The current position MUST be shown.

#### Scenario: Next

- GIVEN focus on the body at `/path/avalanche`
- WHEN ArrowRight is pressed
- THEN the route is `/path/first-tx`

#### Scenario: Ignored in input

- GIVEN focus in a text input
- WHEN ArrowRight is pressed
- THEN the route does not change

#### Scenario: Ends

- GIVEN the last screen
- WHEN ArrowRight is pressed
- THEN the route stays

### Requirement: Landing content

`/` MUST show the `> HACKATWIN_` hero, a manifesto, split cards, a tagline band, an FAQ, and a "Built on Avalanche" text
link (O4). The layout MUST collapse to one column below 768px.

#### Scenario: Sections

- GIVEN the `/` markup
- WHEN its landmarks are read
- THEN hero, manifesto, cards, tagline, FAQ, and the link exist

### Requirement: Copy in one module

All screen copy MUST live in one module; English until O14 says otherwise. Components MUST receive copy as props.

#### Scenario: No inline copy

- GIVEN the screen components
- WHEN scanned for literal user-facing strings
- THEN they come from the copy module

#### Scenario: Static screens

- GIVEN `/path/avalanche`, `/path/production`, `/path/built-by-agents`
- WHEN rendered with no services running
- THEN they render fully with no network call

## Traceability

| Done-when box | Requirement |
|---|---|
| Screen routes match section 7 | Routes match PLAN section 7 |
| Presenter keyboard navigation moves between screens | Presenter keyboard navigation |
| Copy language follows O14 | Copy in one module |
| (what) landing | Landing content |
