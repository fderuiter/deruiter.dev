# 0009. Responsive Layout Integrity, Stacking Context Isolation, and Defensive CSS Standard

Date: 2026-08-15

## Status

Accepted

## Context

Web applications spanning diverse content types (marketing hero sections, Bento grids, multi-panel clinical data editors, formal proof graph assistants, and canvas simulators) frequently suffer from visual clipping, text overlapping, and layout distortion when viewed on variable screen widths (320px to 4K), under localized content expansion (e.g. German translations +40%), or when dynamic mobile browser bars expand and contract.

These defects stem from four primary root causes:

1. **Rigid Container Heights**: Using fixed heights (`h-48`, `h-64`, `height: 250px`) causes multi-line or wrapped text to spill out or be truncated abruptly.
2. **Flexbox/Grid Intrinsic Min-Width**: By default, flex and grid items have `min-width: auto`, preventing children from shrinking below their intrinsic content width and pushing neighboring columns or buttons out of bounds.
3. **Unmanaged Z-Index Wars**: Arbitrary z-index inflation (`z-[9999]`) causes unexpected layering bugs across dialogs, command palettes, and background decorations.
4. **Ad-Hoc Magic Numbers & Viewport Media Queries**: Scattering uncalibrated pixel sizes across components instead of leveraging `@container` queries, fluid `clamp()` typography, and centralized design tokens.

## Decision

We establish five core architectural standards across all layout wrappers, pages, and components:

### 1. Flexible Intrinsic Bounds & Semantic `<PageLayout />`

- All page-level route wrappers utilize `<PageLayout />` (`variant="standard"` for max-w-7xl content or `variant="studio"` for full-bleed interactive workspaces), enforcing `min-h-dvh` (Dynamic Viewport Height) and `overflow-x-hidden`.
- The root layout (`app/layout.tsx`) remains the sole provider of the semantic `<main id="main-content">` landmark to preserve WCAG AA accessibility compliance without duplicate nested `<main>` tags.
- Dynamic containers specify `min-h-*` and `h-auto` rather than fixed `h-*` to allow natural expansion as localized content scales.

### 2. Flexbox/Grid Defenses & Differentiated Wrapping

- Flex and grid children that contain text, badges, or truncation elements must apply `min-w-0` (or `min-h-0` in vertical flex layouts) to override `min-width: auto`.
- Prose, headers, and descriptions enforce `break-words` (`overflow-wrap: break-word; text-wrap: balance;`).
- Long URLs, cryptographic hashes, and identifiers apply `text-token-break` (`overflow-wrap: anywhere; word-break: break-word;`).
- Complex mathematical AST deduction ledgers and matrices retain dedicated horizontal scroll containers.

### 3. Stacking Context Isolation & Bounded Elevation Scale

- Multi-layered sections apply CSS `isolation: isolate` (`.section-isolate`) to keep internal layer stacks localized.
- Elevation is strictly bounded across 4 standard tiers:
  - Background & Gradients: `-z-10`
  - Interactive Content: `relative z-10`
  - Fixed Global Navigation: `z-40`
  - Modals, Drawers, and Command Palette: `z-50`
- Arbitrary z-index escalation (`z-[9999]`) is strictly forbidden and flagged in CI.

### 4. Component Independence via Container Queries (`@container`)

- Modular card components (`BentoGrid` cards, `PretextCard`, `ProjectTeaserGrid`, `CaseStudyShowcase`) establish `@container` contexts.
- Typography, padding, and internal flex orientation adapt relative to parent card width using `@sm:` and `@md:` modifiers rather than global viewport media queries.

### 5. Multi-Tier Automated Verification & Stress Testing

- Static AST/regex inspection rule in `lib/dx/doctor.ts` (`checkLayoutTextClippingInvariants`) scanning for uncalibrated magic numbers, missing `min-w-0`, rigid heights, and rogue z-indexes.
- Vitest dynamic content stress suite (`__tests__/defensive-css-stress.test.tsx`) rendering components with +40% text expansion, 100-character unbroken tokens, and 200% font zoom simulations.
- Playwright viewport test probes asserting `element.scrollWidth <= element.clientWidth` across 320px–1280px viewports.

### 6. Fluid Responsive SVG Viewports & Dynamic Coordinate Boundaries

- Interactive SVG viewports and canvas workspace wrappers (`ProofCanvas`, `ProofWorkspaceSkeleton`, `VectorComparisonViewer`) eliminate fixed horizontal width limits (`min-w-[760px]`, `min-w-[800px]`) in favor of fluid `w-full` sizing and container query width units (`w-[100cqw]`).
- Coordinate alignment guides (`maxGuideX`) and gesture boundaries dynamically observe container dimensions via `ResizeObserver` and `clientWidth`, providing accurate bounding calculations on mobile (375px) and desktop viewports without horizontal clipping or scrollbar locks.

## Consequences

- Zero text clipping, horizontal layout blowouts, or overlapping elements across smartphones, foldables, tablets, and desktops.
- True modularity: Cards and widgets can be safely embedded in narrow sidebars or wide canvas layouts without breaking.
- Strict design token governance eliminating ad-hoc magic numbers.
- Automated CI gates guarding against layout regressions.
