# 0015. Human-First Editorial Voice, "Make Things Better" Ethos & Container-First Responsive Layout Architecture

Date: 2026-08-19

## Status

Accepted. The "Recruiter vs. Reality" toggle named below was renamed to the
Professional / Behind the Scenes perspective by
[ADR 0047](0047-peer-engineering-narrative-and-dual-layer-perspective.md).

## Context

Previous iterations of the portfolio established deep technical credibility through formal mathematical, regulatory (CDISC, 21 CFR Part 11), and embedded systems terminology. However, this academic framing created several critical user experience frictions:

1. **Alienating Technical Jargon**: The copy read as overly formal and robotic, failing the "Family & Friends" test where non-technical visitors, friends, and hiring managers could not immediately understand who Frederick is or what problem was solved.
2. **Missing Authentic Personal Identity**: The narrative emphasized abstract software titles rather than Frederick's authentic superpower: being a pragmatic, relentless problem solver who steps up to make things work and helps people out (e.g. securing free menstrual products in university bathrooms, acting as university liaison for the Minnesota Vikings Training Camp, 3D printing brain models at Mayo Clinic, and creating the Laser Loon cultural phenomenon).
3. **Mid-Viewport (Tablet) Layout Squeeze**: Desktop-centric 12-column split layouts and bento grids experienced compression and awkward word wrapping on tablet viewports (640px–1023px) and required standardized container query encapsulation.

## Decision

We execute a comprehensive editorial and responsive layout overhaul anchored on three pillars:

### 1. The "Make Things Better" Ethos & Plain-Language Invariant

- **Plain-Language Clarity Invariant**: All primary hero headlines, section intros, and case study overviews must pass the "Family & Friends" test: explaining what was built, why it's cool, and how it solves real problems in clear, engaging, human English.
- **Relatable Narrative Arc**: Reframe the personal journey from campus advocate and NFL camp liaison to Mayo Clinic clinical operations innovator and full-stack systems builder.
- **Dual-Layer Editorial Persona**: Baseline copy is warm, witty, and approachable; deep technical telemetry and unvarnished engineering realities remain accessible via the interactive _"Recruiter vs. Reality"_ toggle and console sandboxes.

### 2. Container-First Modular Responsive Architecture

- **Centralized Layout Primitives**: Standardize wrapper components (`<PageLayout>`, `<SectionHeader>`, `<ResponsiveCard>`) to enforce `min-w-0`, `min-h-0`, and flexible container constraints (`min-h-*` over fixed `h-*`).
- **Dedicated Tablet Layout Rules (640px–1023px)**: Balance bento cards into 2-column flow, stack hero consoles vertically with balanced spacing, and deploy smooth drawer navigation.
- **Mobile Touch & Viewport Bounds (320px–639px)**: Enforce 44px+ minimum touch targets, `min-h-dvh` dynamic viewport height adaptation, and strict `element.scrollWidth <= element.clientWidth` zero-overflow invariant.

### 3. Phased Rollout Protocol

- **Phase 1 & 2 (Core Hub)**: Standardize layout primitives and execute full rewrite of Homepage (`app/page.tsx`), Hero (`components/Hero.tsx`), Navigation/Footer/Palette (`components/Navbar.tsx`, `components/Footer.tsx`, `components/CommandPalette.tsx`), and Timeline Dictionary (`lib/i18n-dictionary.ts`).
- **Phase 3 (Sub-Pages)**: Sequentially roll out aligned voice and container styles to `/case-studies`, `/arcade`, `/stack`, `/schedule`, and studio entrypoints.

## Consequences

- Portfolio narrative becomes immediately engaging, human, and fun for all visitors while retaining high-assurance technical proof in interactive sandboxes.
- Flawless responsive presentation verified across 320px mobile, 768px/810px tablet, and 1440px+ desktop viewports.
- Maintainable component architecture with centralized container query rules and zero layout drift.
