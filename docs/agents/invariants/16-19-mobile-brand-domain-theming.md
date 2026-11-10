# AGENTS.md sections 16 to 19: Mobile performance, brand assets, domain and theming

The full text of [AGENTS.md](../../../AGENTS.md) sections 16 to 19, with the reasons behind each rule. AGENTS.md keeps one line per rule; this page keeps why. Section numbers match AGENTS.md.

## 16. Mobile Runtime Performance & Animation Invariants

- **Background Animation Throttling**: Background SVG and particle canvas animations (e.g. `AnimatedGridPattern`, collision beams) must use hardware-accelerated CSS keyframes on mobile viewports (`< 768px`) or be clamped to static composited loops. They must never trigger continuous React `setState` updates or loop `onAnimationComplete` callbacks in mobile render trees.
- **GPU Blur & Compositing Bounds**: Heavy gaussian blur layers (`blur-[100px]` or greater) and overlapping multi-layer `backdrop-blur` filters must be suppressed or substituted with lightweight CSS radial gradients (`hidden sm:block` or responsive classes) on mobile devices to prevent GPU rasterization stalls during scrolling.
- **ResizeObserver Dimension Isolation**: Dynamic text layout engines and Pretext observers must isolate width measurements (`Math.floor(contentRect.width)`) from height fluctuations to prevent mobile browser URL bar / address-bar collapse during scrolling from triggering unnecessary canvas text layout recalculations.
- **Touch & Synthesizer Isolation**: Synthesized Web Audio effects tied to mouse cursor movement (such as hover frequencies) must defensively check `window.matchMedia('(hover: none)').matches` to avoid unwanted audio thread contention during mobile touch-scrolling. Interactive touch buttons and cards must supply instant tactile scaling (`active:scale-[0.98]`).

## 17. Brand Assets, Headless SVG Rasterization & Satori OpenGraph Invariants

- **Headless SVG Rasterization Fallbacks**: SVGs consumed by Node.js build pipelines, `sharp`, or `librsvg` must define explicit inline presentation attributes (`fill="..."`, `stroke="..."`) on geometry elements in addition to CSS class styles, preventing unparsed CSS custom properties from rasterizing as solid black silhouettes.
- **Satori (`next/og`) Layout Flow**: Dynamic `ImageResponse` social card generators (`lib/og-image.tsx`, `app/**/opengraph-image.tsx`) must avoid `zIndex` properties, relying strictly on flexbox and natural DOM document order for ambient glow and card stacking.
- **Asset Hygiene & PWA Manifest Parity**: Default boilerplate assets (`vercel.svg`, `next.svg`, `file.svg`, `globe.svg`, `window.svg`, default 25KB placeholder `favicon.ico`) must be removed, maintaining dedicated multi-size binary ICOs (16/32/48px), Apple Touch icons (180x180), PWA icons (192/512px), and dynamic `app/manifest.ts` metadata synchronization.

## 18. Canonical Domain, Base URL & Production Routing Invariant

- **Single Source of Truth**: All canonical URLs, `metadataBase`, dynamic sitemaps (`app/sitemap.ts`), robots directives (`app/robots.ts`), OpenGraph preview metadata, and Schema.org JSON-LD structured data generators (`lib/seo.ts`) must resolve via `resolveBaseUrl()` in `lib/domain.ts` and `SITE_BASE_URL` in `lib/seo.ts`.
- **Production Domain Parity**: The canonical production domain is strictly `https://deruiter.dev` (the apex, matching Vercel's primary domain routing; `www.deruiter.dev` issues a `308` to it at the edge). Route entrypoints, error layouts (`components/UnifiedErrorLayout.tsx`, `app/error.tsx`), and social generators must never hardcode temporary `.vercel.app`, `fderuiter.dev`, or the non-canonical `www` host.
- **Dynamic Preview & Clipboard Isolation**: Runtime origin is scoped strictly to link sharing. `getActiveHostUrl()` in `lib/clipboard.ts` may read `window.location.origin` in active browser runtimes; `resolveBaseUrl()` must never do so, so that canonical tags, sitemaps, JSON-LD and OpenGraph metadata are byte-identical whether rendered on the server or in the browser. Headless SSR fallbacks and test harnesses validate deterministically against `https://deruiter.dev`.

## 19. Studio Container Theming & Scoped Design Tokens

- **Container-Level Scoping**: Interactive studio suites and simulators (CRF Studio, Proof Canvas, Neuro Simulator) offering independent light/dark modes must apply themes via container data attributes (`[data-studio-theme="light"]` / `[data-studio-theme="dark"]`) and CSS custom property cascades (`--crf-bg`, `--crf-surface-1`, `--crf-border`, etc.) rather than mutating the root `<html>` element. This preserves the surrounding portfolio's architectural frame, global navbar, and route landmarks.
- **State Persistence & URL Sync**: Studio-level theme preferences must default to dark mode for portfolio consistency, persist in `localStorage`, and synchronize cleanly with URL hash parameters (`#theme=light`) using `useStudioHashParams`.
