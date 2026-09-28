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

- **Global Viewport & Brand Accent (#1251)**: Declare a root `viewport` export in `app/layout.tsx` specifying `themeColor: "#090D16"` and `colorScheme: "dark"` to enforce brand cyan accent borders on Discord embeds and mobile browser address bars.
- **Strict Payload & Dimension Invariants (#1252)**: Guarantee all dynamically rendered OpenGraph images (`1200x630`) are compressed to under 250 KB (safely below WhatsApp's strict 300 KB threshold) and emit explicit `og:image:width`, `og:image:height`, and `og:image:type: "image/png"` headers.
- **Satori Brand Font Cache (#1252)**: In-memory caching of local TTF font buffers (`Lexend`, `Geist Mono`) within the Satori OpenGraph rendering pipeline (`lib/og-image.tsx`) to guarantee typographic parity with the live site across social platforms.
- **Asset-Enriched Visual Presets (#1252)**: Upgrade `lib/og-image.tsx` from abstract typography-only cards to include rendered visual artifacts:
  - Vector artwork embed for Laser Loon (`/work/laser-loon`, `/arcade/laser-loon`).
  - Mini 12-column responsive form canvas mockup for CRF Studio (`/crf`).
  - Memory-in-pixel display frame for Garmin Monkey C simulator (`/arcade/garmin-watch`).
  - **Technical Dossier Social Chip**: Dynamic preview elements (reading time, publication date, primary language, verified badge) for engineering case studies and blog articles.
- **Metadata Character Bounds & Brand Deduplication (#1251)**: Enforce strict metadata character bounds in `lib/seo-metadata.ts` (titles: 50–60 characters, descriptions: 140–160 characters). Harden the brand deduplication regex to strip trailing variations (`| Frederick de Ruiter`, `| Fred de Ruiter`, `- Frederick de Ruiter`).

### 2. Generative Engine Optimization (GEO) & AEO Build-Time Manifests

- **Standardized Machine Manifests (#1253)**: Deploy standardized machine-readable manifests at `/public/llms.txt` and `/public/llms-full.txt`.
- **Compile-Time Static Generation (#1253)**: Generate manifests statically at build time via `scripts/generate-llms-txt.ts` from `ROUTE_METADATA_CONFIGS`, case studies, and architecture documentation.
- **Crawler Permissions Invariant (#1253)**: Update `app/robots.ts` with explicit crawler permissions allowing AI answer engine crawlers to fetch `/llms.txt` and `/llms-full.txt`.
- **Zero-Neon-Wake Invariant ([ADR 0043](0043-provider-backed-media-storage-and-zero-wake-telemetry.md))**: AI crawler reads never trigger runtime serverless database queries.

### 3. Contextual Engineering Bridges (In-DOM Semantic Article + Jump Trigger)

- **Semantic Section Architecture (#1255)**: Interactive tool and game pages (`/crf`, `/patrol`, `/arcade/*`) render an accessible in-DOM semantic article section (`<section aria-labelledby="systems-architecture">`) beneath the primary canvas/workspace.
- **Algorithmic Narrative & PageRank Backlinks (#1255)**: Detail the underlying engine architecture, state machines, and algorithmic constraints, linking directly to related deep-dive case studies and ADRs to distribute internal PageRank.
- **Sticky Jump Navigation (#1255)**: Provide an unobtrusive sticky header jump trigger ("Architecture & Engine Notes") allowing human visitors to navigate directly to the retrospective without interrupting their canvas workflow.

### 4. Visible FAQ Accordion Standard for Rich Google SERP Snippets

- **Schema.org Integration (#1254)**: High-value landing pages (`/schedule`, `/crf`, `/work/laser-loon`) integrate Schema.org `FAQPage` entities into their `@graph` structured data.
- **Visible FAQ Accordion Standard (#1254)**: In accordance with Google Search Central guidelines, all schema FAQ items must correspond to an authentic, visible, keyboard-navigable `<FAQAccordion />` component rendered in the page DOM to prevent deceptive cloaking penalties.

### 5. Automated SEO & Social Preview Invariant Audit

- **Automated Regression Suite (#1256)**: Implement a dedicated Vitest test suite (`__tests__/seo-social-integrity.test.ts`) asserting that all routes in `ROUTE_METADATA_CONFIGS` have bounded metadata lengths, zero double-branding, root viewport `themeColor`, dynamic OG image buffers <= 250 KB, and synchronized `/llms.txt` entries.
- **DX Doctor Gate (#1256)**: Integrate SEO and social preview invariant audits into `scripts/dx.ts doctor` (`lib/dx/doctor.ts`) to fail fast during `npm run quality` and pre-commit checks.

## Invariant Compliance

- **Zero-Neon-Wake ([ADR 0043](0043-provider-backed-media-storage-and-zero-wake-telemetry.md))**: Compile-time static generation ensures AI crawler traffic incurs zero database compute wake.
- **Free-Tier Quota Bounds ([AGENTS.md](../AGENTS.md) Section 22)**: Edge-cached social images under 250 KB and static manifests eliminate compute bandwidth bloat.
- **Continuous Accessibility ([AGENTS.md](../AGENTS.md) Section 10)**: In-DOM engineering bridges and FAQ accordions adhere strictly to WCAG 2.1 Level AA keyboard navigation and ARIA landmarks.

## Consequences

- Inbound links shared across iMessage, WhatsApp, Slack, Discord, and LinkedIn render high-contrast, visually compelling preview cards with 100% platform reliability without WhatsApp 300KB cutoff drops.
- AI search engines receive clean, structured, and citation-ready markdown without waking sleeping serverless databases.
- Search crawlers index rich technical prose and internal backlinks across gaming and utility surfaces.
- Rich FAQ accordion snippets in Google search results significantly expand SERP visual footprint and organic CTR while complying strictly with anti-cloaking policies.
- Automated test suites and DX Doctor checks prevent regression or metadata drift across future release trains.
