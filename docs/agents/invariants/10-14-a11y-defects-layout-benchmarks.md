# AGENTS.md sections 10 to 14: Accessibility, defects, layout integrity and benchmarks

The full text of [AGENTS.md](../../../AGENTS.md) sections 10 to 14, with the reasons behind each rule. AGENTS.md keeps one line per rule; this page keeps why. Section numbers match AGENTS.md.

## 10. Continuous Accessibility (a11y) & WCAG 2.1 Conformance

- All public pages, interactive modals, drawers, and forms must maintain strict WCAG 2.1 Level AA compliance with zero Critical, Serious, or Moderate axe-core violations.
- Root layout (`app/layout.tsx`) must provide a visible-on-focus `<SkipToContent />` link targeting `<main id="main-content" tabIndex={-1}>`, alongside the global screen reader live announcer provider (`A11yProvider`).
- Interactive modal containers and mobile navigation drawers must enforce focus trapping (`useFocusTrap`) with Escape dismissal and focus restoration to the originating trigger.
- Canvas-driven experiences (games, 3D brain simulator, proof DAGs) must supply accessible fallback descriptions and keyboard-navigable controls.

## 11. Defect Remediation & Root-Cause Regression Invariant

- All bug fixes and defect remediations across core computational engines (`lib/proof-utils.ts`, `lib/garmin/engine.ts`, `lib/working-with-duck-engine.ts`, `lib/crf/internal/ast-evaluator.ts`) must follow the strict Red-Green Remediation Protocol.
- Every patch must include an isolated reproduction test in `__tests__/` verifying pre-fix failure and post-fix success, backed by regression test coverage in `__tests__/defect-remediation-regression.test.ts`.
- Core calculation and state engines must enforce boundary defenses against division-by-zero, cyclic AST references, and out-of-bounds inputs with zero unhandled crash vectors.

## 12. Proactive Defect Interception & Synthetic Reliability

- Core deterministic logic and security sanitization modules must maintain property-based fuzz tests (`__tests__/property-fuzz.test.ts`) and pass fast-check property fuzzing gates.
- Critical user journeys (Landing Pretext layout, Command Palette discovery, Proof DAG studio, Arcade canvas lifecycles, and API telemetry ingestion) must be verified via Playwright synthetic user probes (`__tests__/e2e/synthetic-probes.spec.ts`) and monitored continuously via scheduled crons (`.github/workflows/synthetic-probes.yml`).
- In Playwright synthetic user probes and end-to-end browser tests, interactive UI triggers (e.g. Command Palette search buttons, mobile navigation triggers, modal openers) must be wrapped in `expect(async () => { ... }).toPass({ timeout: 15000 })` polling blocks to prevent hydration race conditions where clicks land on static HTML before React 19 event listeners attach.
- Modals and animated drawers hosted in `<AnimatePresence>` must specify an explicit `key` prop (e.g. `key="command-palette-modal"`) on their outermost container to ensure deterministic presence tracking during fast multi-browser headless evaluation.
- Arcade canvas probes targeting `/arcade/*` must interact with the `<PlayCabinet>` launch workflow (`getByRole("button", { name: /Launch Cabinet/i }).click()`) and allow for CRT warmup before asserting `<canvas>` context availability.
- Canary analysis (`scripts/canary-analyzer.ts`, `npm run canary:eval`) is manual tooling that evaluates caller-supplied metric windows against hard SLA limits (5xx error rate <= 0.5%, p95 latency <= 800ms, Sentry exception spike ratio <= 2.0x). Nothing invokes it automatically, and nothing in the repository promotes or rolls back a deployment: the weekly release train fires a Vercel Deploy Hook only after Merge Gate and its release-candidate suite pass, and smoke-tests the live site before publishing the release ([ADR 0063](../../../adr/0063-weekly-release-train.md), `DEPLOYMENT.md`). Rollback is a person using Vercel's Instant Rollback.

## 13. Layout Integrity, Defensive CSS & Stacking Context Isolation

- All route page wrappers must use `<PageLayout />` or declare `min-h-dvh` and `overflow-x-hidden` without introducing duplicate nested `<main>` landmarks.
- Dynamic containers must enforce flexible bounds (`min-h-*`, `h-auto`) over rigid fixed heights (`h-48`, `h-64`) when hosting text elements.
- Flex and grid children hosting text or truncation badges must declare `min-w-0` to neutralize CSS `min-width: auto` and prevent layout blowouts.
- Multi-layered composite sections must declare `isolation: isolate` (`.section-isolate`), with system-wide elevation strictly bounded between `-z-10` and `z-50` (zero arbitrary `z-[9999]`).
- Modular cards and widgets must utilize Container Queries (`@container`, `@sm:`, `@md:`) for internal layout adaptation rather than global viewport media queries.
- Interactive SVG viewports and canvas workspace wrappers (e.g. `ProofCanvas`, `ProofWorkspaceSkeleton`, `VectorComparisonViewer`) must utilize fluid `w-full` containers, container query width units (`w-[100cqw]`), and dynamic wrapper dimension tracking (`ResizeObserver`) rather than rigid minimum width limits (`min-w-[760px]`, `min-w-[800px]`). Dynamic coordinate alignment guides (`maxGuideX`) must scale relative to active wrapper bounds.
- Scoped sub-studio theme variants (such as `[data-studio-theme="light"]` and `[data-studio-theme="dark"]` for CRF Studio) must be declared with scoped CSS variables (`--crf-*`) and attribute cascades in `app/globals.css` to prevent light mode overrides from leaking into the global dark-mode layout.
- Layout resilience against +40% localized text expansion, unbroken URLs, and 200% font zoom must be verified via `__tests__/defensive-css-stress.test.tsx` and `lib/dx/doctor.ts`.
- When authoring DOM assertions on components where multiple child elements share defensive utility classes (e.g. `.break-words` on both title and description), use `querySelectorAll` with indexed access or dedicated test IDs rather than ambiguous single `querySelector` lookups.
- Production layout verification must adhere to the Four-Layer Layout Validation Protocol:
  - **DevTools Stress Routine**: 320px squeeze (iPhone SE minimum), 200% zoom (WCAG 1.4.4 restacking), and 3x content fuzzing.
  - **Horizontal Overflow Detector**: Automated evaluation (`getBoundingClientRect().right > clientWidth`) across all DOM elements in Playwright (`__tests__/e2e/visual.spec.ts`).
  - **Multi-Viewport Visual Matrix**: Continuous regression coverage across Mobile (320px & 375px), Tablet (768px), and Desktop (1440px).
  - **Real-Device Verification**: Verification on real iOS Safari (`min-h-dvh` floating bar clearance) and Android ("Largest" font scaling).

## 14. Continuous Real-Browser Page Benchmarking & Web Vitals Profiling

- Any new first-class route, case study, or interactive mini-game must be registered in `PUBLIC_ROUTE_REGISTRY` in `lib/public-routes.ts`; `CANONICAL_ROUTES` in `lib/dx/page-bench.ts` is derived from it, and DX Doctor's `routes-public-registry-drift` check fails on a route missing from it.
- Real-browser navigation timing and Core Web Vitals (TTFB, FCP, LCP, CLS) must be benchmarked against production builds via `npm run bench:pages` or `npx tsx scripts/benchmark-pages.ts`.
- In CI and pre-release gates, performance budgets can be enforced via `--assert` / `--budget` flags, ensuring fleet median LCP <= 2500ms, TTFB <= 800ms, and CLS <= 0.1.
