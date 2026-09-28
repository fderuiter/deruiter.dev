# ADR 0053: Generative Engine Optimization and Multi-Platform Social Previews

## Status

Accepted on 2026-09-28. Extends [ADR 0017](0017-unified-schema-org-entity-graph-and-tiered-seo-architecture.md) and [ADR 0043](0043-provider-backed-media-storage-and-zero-wake-telemetry.md).

## Context

The portfolio previously optimized for traditional search engine indexation through a unified Schema.org `@graph` ([ADR 0017](0017-unified-schema-org-entity-graph-and-tiered-seo-architecture.md)) and static XML sitemaps. However, two major shifts in discoverability created strategic gaps:
1. **AI / Answer Engine Ingestion**: Emerging AI search systems (ChatGPT Search, Perplexity, Claude, Copilot, Cursor) bypass standard HTML rendering, prioritizing structured markdown summaries, explicit entity authority bindings (`sameAs`), and standardized `/llms.txt` registries. Relying purely on client-hydrated DOM or unparsed HTML results in inaccurate AI citations.
2. **Social Preview Degradation Across Chat Applications**: When sharing links via messaging platforms (iMessage, WhatsApp, Slack, Discord, LinkedIn), preview generation was inconsistent. WhatsApp dropped link previews exceeding 300 KB, Discord rendered neutral gray cards due to missing root `theme-color` viewport metadata, and Satori OpenGraph cards displayed generic code badges rather than recognizable visual artwork (e.g. Laser Loon vector artwork or CRF Studio form designer mockups).
3. **Isolated Search Silos**: Interactive tools (`/crf`, `/patrol`, `/arcade/*`) operated in visual isolation from deep-dive architectural case studies and ADRs, limiting cross-site PageRank distribution and missing opportunities to convert top-of-funnel gamers or tool users into engineering consultation clients.

## Decision

### 1. Multi-Platform Social Preview Standard & Asset-Enriched Satori Cards

- **Global Viewport & Brand Accent**: Declare a root `viewport` export in `app/layout.tsx` specifying `themeColor: "#090D16"` to enforce brand cyan accent borders on Discord embeds and mobile browser address bars.
- **Strict Payload & Dimension Invariants**: Guarantee all dynamically rendered OpenGraph images (`1200x630`) are compressed to under 250 KB (safely below WhatsApp's strict 300 KB threshold) and emit explicit `og:image:width`, `og:image:height`, and `og:image:type` headers.
- **Asset-Enriched Visual Presets**: Upgrade `lib/og-image.tsx` from abstract typography-only cards to include rendered visual artifacts:
  - Vector artwork embed for Laser Loon (`/work/laser-loon`, `/arcade/laser-loon`).
  - Mini 12-column responsive form canvas mockup for CRF Studio (`/crf`).
  - Memory-in-pixel display frame for Garmin Monkey C simulator (`/arcade/garmin-watch`).
  - Author credentials, reading time, and primary stack badges for engineering case studies and blog articles.

### 2. Generative Engine Optimization (GEO) & Build-Time `llms.txt`

- Deploy standardized machine-readable manifests at `/public/llms.txt` and `/public/llms-full.txt`.
- Generate manifests statically at build time via `scripts/generate-llms-txt.ts` from `ROUTE_METADATA_CONFIGS`, case studies, and architecture documentation.
- Adhere strictly to the Zero-Neon-Wake invariant ([ADR 0043](0043-provider-backed-media-storage-and-zero-wake-telemetry.md)): AI crawler reads never trigger runtime serverless database queries.

### 3. Contextual Engineering Bridges (In-DOM Semantic Article + Jump Trigger)

- Interactive tool and game pages (`/crf`, `/patrol`, `/arcade/*`) render an accessible in-DOM semantic article section (`<section aria-labelledby="architecture-notes">`) beneath the primary canvas/workspace.
- This section details the underlying engine architecture, state machines, and algorithmic constraints, linking directly to related deep-dive case studies and ADRs to distribute PageRank.
- The interactive viewport provides an unobtrusive sticky header jump button ("Architecture & Engine Notes") allowing human visitors to navigate directly to the retrospective without interrupting their canvas workflow.

### 4. Visible FAQ Accordion Invariant for Rich Google SERP Snippets

- High-value landing pages (`/schedule`, `/crf`, `/work/laser-loon`) integrate Schema.org `FAQPage` entities into their `@graph` structured data.
- **Visible Rendering Invariant**: In accordance with Google Search Central guidelines, all schema FAQ items must correspond to an authentic, visible `<FAQAccordion />` component rendered in the page DOM to prevent deceptive cloaking penalties.

## Consequences

- Inbound links shared across iMessage, WhatsApp, Slack, Discord, and LinkedIn render high-contrast, visually compelling preview cards with 100% platform reliability.
- AI search engines receive clean, structured, and citation-ready markdown without waking sleeping serverless databases.
- Search crawlers index rich technical prose and internal backlinks across gaming and utility surfaces.
- Rich FAQ accordion snippets in Google search results significantly expand SERP visual footprint and organic CTR.
