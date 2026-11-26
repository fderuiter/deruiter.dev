# 0017. Unified Schema.org @graph Entity Engine & Tiered SEO Discovery Architecture

Date: 2026-08-19

## Status

Accepted

## Context

The portfolio previously implemented fragmented JSON-LD structured data:

1. **Disconnected Root Scripts**: `app/layout.tsx` injected isolated `Person` and `WebSite` schemas without semantic `@id` node relationships.
2. **Disjoint Route Schemas**: Individual sub-pages and studios (`/crf`, `/proof`, `/arcade/*`, `/case-studies/*`) injected standalone `<script>` tags without establishing `isPartOf` or `author` relationships to the root site.
3. **Mismatched Schema Classifications**: High-traffic visual asset hubs (such as `/work/laser-loon` and `/case-studies/laser-loon`) were classified as `SoftwareSourceCode`, missing Google Image licensing badges and rich vector metadata (`image/svg+xml`, `application/illustrator`).

## Decision

We adopt a centralized, unified Schema.org `@graph` architecture in `lib/seo.ts`:

### 1. Unified `@graph` Topology

- Every page emits a single structured `@graph` containing interconnected entity nodes:
  - `Person (#person)`: Frederick de Ruiter with social profiles (`sameAs`), role, and portfolio references.
  - `WebSite (#website)`: Root portfolio authority with publisher linkage to `#person` and Google Sitelinks `SearchAction`.
  - `WebPage (#webpage)`: The active route declaring `isPartOf: { "@id": "#website" }`, `breadcrumb: { "@id": "#breadcrumb" }`, and `author: { "@id": "#person" }`.
  - `BreadcrumbList (#breadcrumb)`: Normalized route traversal hierarchy.

### 2. Tiered Specialized Entity Dispatching

- **Tier 1 (Systems Case Studies)**: Dispatches `TechArticle` and `SoftwareSourceCode` with GitHub telemetry stats (`interactionStatistic`), programming language, and repository URL.
- **Tier 2 (Graphic Design & Asset Hubs)**: Dispatches `VisualArtwork` and `MediaObject` with Creative Commons license, dimensions, and vector format declarations for Laser Loon.
- **Tier 3 (Interactive Studios & Simulators)**: Dispatches `WebApplication` with application categories (`DeveloperApplication`, `EducationalApplication`), browser requirements, and zero-cost license declarations.

## Consequences

- Search engine crawlers (Google Knowledge Graph, Rich Snippets) receive a fully resolved semantic entity graph.
- Unlocks Google Image licensing tags, Sitelinks Search Box, and software application rich cards.
- Centralizes all Schema.org logic in `lib/seo.ts` with strict TypeScript typing and unit test verification.
