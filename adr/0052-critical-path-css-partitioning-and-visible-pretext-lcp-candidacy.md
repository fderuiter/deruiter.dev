# ADR 0052: Critical Path CSS Partitioning and Visible Pretext LCP Candidacy

## Status

Accepted on 2026-09-25. Extends [ADR 0040](0040-dyslexia-first-typography-and-dynamic-pretext-accessibility.md) and addresses GitHub issue #817.

## Context

PageSpeed and Core Web Vitals audits on the production landing page (`/`) identified three performance bottlenecks:

1. **LCP Element Attribution & Render Delay**: Pretext text components historically rendered an opaque visual layout element (`data-pretext-layer="visual"`) underneath a transparent semantic overlay (`data-pretext-layer="semantic"`, styled with `color: transparent; -webkit-text-fill-color: transparent`). Chromium and WebKit disregard transparent text when calculating Largest Contentful Paint (LCP) candidates. Consequently, the browser scored an arbitrary `<p>` tag rather than the semantic `<h1>` as the page's LCP element.
2. **Hydration Forced Reflows**: Synchronous layout measurements (`getBoundingClientRect`) and document-level style mutations (`document.documentElement.style.setProperty("--header-height", ...)`) fired during initial mount across `Navbar.tsx`, `BentoGrid.tsx`, and `usePretextLayout.tsx`, causing forced synchronous layout reflows on the main thread during hydration.
3. **Render-Blocking Global CSS Weight**: The root stylesheet (`app/globals.css`, imported in `app/layout.tsx`) bundled hundreds of lines of specialized arcade cabinet animations, CRT scanline filters, loud shake keyframes, and landscape orientation media queries. Because Next.js 16 compiles root layout imports into a single critical-path stylesheet, the entire 308 KB raw (~38.6 KB gzip) file blocked first paint on `/`.

## Decision

### 1. Unified Visible Heading Architecture for Pretext Hero Elements

- Eliminate the transparent twin overlay in `HeroHeadline` and `HeroText`.
- `HeroHeadline` renders directly as a single, authentic semantic `<h1>` element with `.fluid-heading-hero` and high-contrast, fully opaque text (`text-white`) on initial server render.
- When Pretext resolves and Framer Motion mounts on desktop, word spans animate directly within the `<h1>` via `transform` only (`y` and `scale`), with `aria-label={text}` on the heading and `aria-hidden="true"` on individual motion spans to maintain seamless WCAG 2.1 AA screen-reader announcements.
- Transparent semantic overlays are reserved strictly for canvas-rendered pretext components (e.g. `PretextCard`) that require exact custom canvas line-break mapping.

### 2. Hydration Layout Thrash Isolation & Pervasive Lazy Geometry

- **Navbar**: Guard `--header-height` and `--navbar-height` updates to avoid writing to `document.documentElement.style` on mount when the measured height equals the default `80px` declared in `:root`. Defer any deviation updates to `requestAnimationFrame`.
- **BentoGrid**: Remove synchronous `getBoundingClientRect()` from the initial `ResizeObserver` callback and window resize listener. Invalidate the cached rect by setting `rectRef.current = null` on resize, deferring geometry computation until active user pointer interaction (`onPointerMove`).
- **Pretext Layout**: Prevent layout thrashing in `useLayoutEffect` by prioritizing non-reflowing metrics (`contentRect.width` via `useResizeObserver` and cached dimensions) over synchronous DOM layout calls.

### 3. Route-Level CSS Partitioning (`app/arcade/arcade.css`)

- Decouple route-specific arcade cabinet styles (`te-*`, `cc-*`, CRT scanlines, cabinet safe areas, and landscape media queries) from `app/globals.css` into `app/arcade/arcade.css`.
- Mount `arcade.css` via `app/arcade/layout.tsx`, scoping the CSS footprint strictly to `/arcade/*` routes and reducing the critical-path stylesheet loaded on the landing page (`/`).
- Global design tokens, typography scales, accessibility focus rings, and dyslexia modes remain centralized in `app/globals.css`.

### 4. Reproducible Throttled Benchmark Tooling

- Add native `--throttled` support to `scripts/benchmark-pages.ts` and `lib/dx/page-bench.ts` using Chrome DevTools Protocol emulation (4x CPU slowdown, 1.6 Mbps download / 750 kbps upload / 150 ms RTT) to provide verifiable, reproducible Core Web Vitals evidence for mobile devices.

## Consequences

- The semantic `<h1>` is an authentic, visible LCP candidate on the very first paint frame.
- Initial hydration produces zero forced reflow blocks exceeding the 16 ms frame budget.
- The critical render-blocking stylesheet on `/` is significantly reduced in size.
- Screen readers, keyboard navigation, and dyslexia typography modes maintain 100% WCAG 2.1 AA conformance without text duplication or desynchronized focus rings.
- Arcade games retain 100% visual and interactive fidelity under `/arcade/*`.
