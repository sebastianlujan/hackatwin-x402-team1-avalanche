---
title: 'ADR 0003: Docusaurus reads docs in place'
---

# ADR 0003: Docusaurus reads `docs/` in place

## Status

Accepted, 2026-11-04 (M1, T1.3).

## Context

`docs/` is the source of truth and is read on GitHub. [PLAN § 2](../PLAN.md#2-repository-structure) places the site
in `apps/docs` with `docs.path` pointing at `../../docs`. The existing files are plain Markdown with tables, braces,
SVG diagrams, and Mermaid blocks.

## Decision

- `apps/docs` uses the classic preset in docs-only mode (`routeBasePath: '/'`, no blog) and reads `../../docs`.
  Nothing is copied.
- `markdown.format: 'detect'`: `.md` files are CommonMark, only `.mdx` files are MDX.
- `@docusaurus/theme-mermaid` renders Mermaid blocks; SVG diagrams load as images.
- `onBrokenLinks` and `onBrokenMarkdownLinks` are `throw`. Broken links are fixed in `docs/`.
- The sidebar is generated from frontmatter (`title`, `sidebar_position`). `docs/README.md` is the landing page.

Rejected: syncing docs into `apps/docs` (two copies drift); MDX for every file (braces and `<` in existing text break
parsing).

## Consequences

- GitHub and the site render the same files, and a broken link fails CI.
- Every doc needs frontmatter. Links that leave `docs/` cannot resolve on the site, so they are written as code spans.
- `.md` files cannot use MDX components.
