<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Architectural & Testing Invariants

### 1. Test Environment & Path Resolution

- Never hardcode environment-specific root paths (such as `/app` or absolute local directories) in tests or scripts.
- Always resolve the workspace root dynamically with `process.cwd()` or `path.resolve(__dirname, '..')`.
- When testing browser storage APIs in JSDOM / Node 25+, ensure `globalThis.localStorage` is properly mocked and isolated with a standard `MockStorage` implementation.
- When running tests in Node 25+, pass `--no-warnings` in `execArgv` to suppress experimental web storage notices. Vitest configs are `.mts` files using `import.meta.dirname`, so Vite loads them as native ESM without a config loader notice; do not reintroduce `VITE_CONFIG_NATIVE_IGNORE_WARNING` or a `.ts` config (#1368).
- Ensure `vitest.setup.ts`, benchmark CLIs (`lib/dx/page-bench.ts`), and type-only barrel index files (`lib/*/types.ts`, `lib/*/index.ts`) are explicitly excluded from `coverage.exclude` in `vitest.config.mts` so mock boilerplate does not skew global coverage gates.
- Production hooks and store subscribers must defensively check `typeof window.localStorage?.getItem === "function"` and `typeof window.localStorage?.setItem === "function"` before accessing storage methods to avoid unhandled exceptions in standalone test harnesses.
- Modules that read environment files (`.env`, `.env.local`) must skip doing so when `process.env.VITEST` is set. `lib/env.ts` and `scripts/build.js` are the reference implementations. A test that deletes `DATABASE_URL` to exercise an offline fallback will otherwise have it repopulated from the developer's real credentials, and Vitest prints both sides of a failed comparison, which is how a live production connection string reached terminal output in #865. The exposure is in test _output_, so secret scanning of staged files does not catch it.
- Test suites must maintain strict import and variable hygiene: remove unused module imports and prefer immutable `const` declarations over `let` unless variable reassignment is required.
- Test suites containing React JSX elements or component rendering must strictly utilize the `.test.tsx` file extension (never `.test.ts`) to satisfy Vitest/oxc JSX transform parsing.
- When mocking constructor functions or methods requiring explicit `this` parameter typing, use `this: Record<string, unknown>` or dedicated mock interfaces rather than `this: any` to comply with `@typescript-eslint/no-explicit-any`.

### 2. Layout & Component Hierarchy

- `app/layout.tsx` renders the global `<Navbar />` and top-level providers (`AudioProvider`, `SearchProvider`).
- Route pages (e.g. `app/proof/page.tsx`, `app/simulator/page.tsx`, `app/schedule/page.tsx`, `app/stack/page.tsx`, `app/work/laser-loon/page.tsx`) must never render a secondary `<Navbar />` component.
- Route entrypoint files (`app/**/page.tsx`) must directly declare root header clearance padding (`pt-24` to `pt-32` or `min-h-screen`/`min-h-dvh` or `<PageLayout />`) to satisfy static DX Doctor invariant audits.

### 3. Route Indexing & Discovery

- Any new first-class route or interactive tool must be synchronized across the 5-Point Discovery Matrix:
  - `components/CommandPalette.tsx` under `staticNavs` with Tabler/Lucide icon, status badge, tech stack tags, and preview highlights.
  - `lib/navigation.ts`, the single data source for the top bar, desktop menus, mobile drawer and footer columns (one entry under the right group, per [ADR 0058](adr/0058-site-navigation-information-architecture.md)).
  - `app/sitemap.ts` and `lib/seo-metadata.ts` under `ROUTE_METADATA_CONFIGS` with canonical path and change frequency.
  - `app/<route>/opengraph-image.tsx` providing a 1200x630 dynamic social preview card matching the systems architecture design system (`lib/og-image.tsx`).
  - `CANONICAL_ROUTES` in `lib/dx/page-bench.ts` (see invariant 14).

### 4. Hydration & React Best Practices

- For client-only rendering or browser API reads, prefer `useSyncExternalStore` over `useEffect` + `useState` hydration flags.
- Keep hook dependency arrays exhaustive across all hooks and memoized callbacks (`useCallback`, `useMemo`) to satisfy React 19 compiler optimization rules (`react-hooks/preserve-manual-memoization`).
- Declare all helper functions and event handlers prior to any `useEffect` blocks that invoke them to prevent temporal-dead-zone immutability errors.
- When synchronizing URL hash or query parameters into component state on mount, use direct derivation where possible or annotate necessary synchronous `setState` calls with `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- Dynamic values that vary between server and client render (e.g. `toLocaleTimeString()`, timestamps, random IDs) must include `suppressHydrationWarning` on the host element or be rendered strictly after mounting.
- When updating external stores, localStorage, or URL hash parameters (e.g. `useStudioHashParams().setParam`), never dispatch mutations or trigger window events synchronously inside functional `setState((prev) => ...)` updater callbacks. Compute the next state value and invoke external store/hash mutations as distinct sequential operations in event handlers or `useEffect` blocks to prevent "Cannot update a component while rendering a different component" execution errors.

### 5. Multi-Agent Integration & Invariant Synthesis

- When merging concurrent feature branches or autonomous agent PRs, always apply **Additive Synthesis** on merge conflicts: never drop features, combine context providers in topological hierarchy (e.g. `PersonaProvider` -> `TerminologyProvider` -> `SearchProvider`), preserve rich text tokens and tooltips, and provide safe fallback defaults for standalone component testing.
- Never commit intermediate agent tracking logs, temporary planning scratchpads (`.scratch/`, `scratch/`, `tmp/`), or ad-hoc adversarial scripts to project git history. Curated agent skills in `.agents/skills/` are tracked configuration.

### 6. Developer Suite (DX) & Quality Invariants

- Run `npm run quality` (or `npm run verify`) to ensure type safety, zero ESLint warnings, docs synchronization, and every architectural invariant reported by DX Doctor passes.
- When adding new games, APIs, ADRs, case studies, or components, utilize `npm run scaffold <type> <name>` to guarantee standard vertical slices and automatic `CommandPalette.tsx` registration.
- Whenever public library or hook signatures change, regenerate TypeDoc markdown with `npm run compile-docs` and verify with `npm run check-docs-drift`.

### 7. Headless Canvas 2D & DOM Observer Testing Lifecycle

- In JSDOM and unit tests for canvas-driven components (games, simulators, neuro slice viewers, Pretext text layout engines), ensure Canvas 2D mock contexts in `vitest.setup.ts` provide:
  - Full curve and stroke methods (`quadraticCurveTo`, `bezierCurveTo`, `arcTo`, `roundRect`, `strokeRect`, `clearRect`, `setLineDash`, `getLineDash`, `clip`, `ellipse`).
  - Realistic `ImageData` instances from `createImageData(w, h)` and `getImageData(sx, sy, sw, sh)` with allocated `Uint8ClampedArray` pixel buffers (`width * height * 4`).
  - Text measurement stubs (`measureText: (text) => ({ width: (text || "").length * 8, height: 16 })`).
- When rendering components or hooks utilizing `ResizeObserver` or `IntersectionObserver` in JSDOM (such as `useResizeObserver` or `PretextCard`), ensure `global.ResizeObserver` / `global.IntersectionObserver` is mocked in `beforeAll` or test setup.
- When mocking external classes or loader constructors invoked with the `new` keyword (e.g. `new OBJLoader()`, `new GLTFLoader()`, `new AudioContext()`), always provide a regular constructor function (`function (this: any) { this.load = mockLoad; }`) or ES6 class implementation in `mockImplementation` rather than an arrow function to prevent runtime `TypeError: ... is not a constructor` exceptions.
- Ensure active component timers and animation frames are unmounted/cancelled cleanly in `afterEach`.
- In unit tests verifying error boundaries, navigation fallbacks, or recovery layouts (`__tests__/unified-recovery.test.tsx`), mock heavy dynamic canvas/WebGL game components (`RetroLabyrinth`, `Brain3DViewer`) with lightweight stubs rather than executing full simulation loops in JSDOM to prevent memory leaks and unhandled worker exceptions.
- Vitest test suites must configure explicit worker heap limits (`execArgv: ['--max-old-space-size=4096']` in `vitest.config.mts`), and pre-commit staging must utilize `vitest related --run --passWithNoTests` to bound test execution scope.

### 8. JSDoc & TypeDoc Markdown Formatting

- In JSDoc comments on exported symbols, avoid numbered prefixes (e.g. `1. ...`) or raw unescaped JSX/HTML tags (e.g. `<Navbar />`), as TypeDoc converts these into markdown files subject to `markdownlint` rules `MD029` (ordered list style) and `MD033` (inline HTML).
- When re-exporting hooks or public API functions from facade files (e.g. `hooks/useAnnouncer.tsx`), ensure all referenced parameter and context interfaces (e.g. `AnnouncerContextType`) are also re-exported to maintain 100% TypeDoc extraction parity with zero compilation warnings.

### 9. Specification & API Documentation Synchronization

- **Full-Spectrum Scope**: All public API endpoints (`app/api/**/route.ts`), TypeScript library/hook exports (`lib/`, `hooks/`, `types/`), architectural decision records (`adr/`), and system architecture guides (`ARCHITECTURE.md`) are governed by automated lockstep synchronization.
- **Declarative Contracts & 100% Coverage**: All HTTP routes must declare runtime Zod validation schemas in `lib/schemas.ts`. `scripts/generate-openapi.ts` dynamically traverses `app/api/**/route.ts` to assert 100% route coverage in `openapi.json` with zero missing endpoints.
- **API Documentation Compilation Command**: Whenever public interfaces, exports, or hooks in `lib/`, `hooks/`, or `types/` are created or modified, execute `npm run compile-docs` to compile TypeDoc reference markdown in `docs/`.
- **Local Documentation Drift Verification**: Prior to committing changes or creating a pull request, run `npm run check-docs-drift` (or `npm run quality` / `npm run verify`) to ensure zero uncommitted documentation drift, untracked generated files, or missing API route contracts.
- **Zero-Drift Invariant Gate**: CI (`.github/workflows/ci.yml`) executes both `npm run check-docs-drift` and `npm run verify`; pre-commit (`.husky/pre-commit`) executes `npm run check-docs-drift` (alongside `typecheck`, `lint:boundaries`, `test:staged`, and `audit:security`). Either gate fails fast (exit code 1) on any uncommitted documentation mutations, untracked generated markdown files, or undocumented API routes.
- **One-Command Auto-Remediation**: Run `npm run doctor:fix` (`npx tsx scripts/dx.ts doctor --fix`) to automatically regenerate `openapi.json`, recompile TypeDoc markdown in `docs/`, and resolve fixable architectural invariants.
- **Documentation Staging Protocol**: When introducing or modifying public exports (`lib/`, `hooks/`, `types/`) or API routes, run `npm run compile-docs` (or `npm run doctor:fix`) prior to staging. Run `npm run check-docs-drift` to verify zero drift. Stage generated markdown files in `docs/` (`git add docs/` or `git add .`) alongside code changes so that Husky's pre-commit `check-docs-drift` hook runs against a clean working tree without untracked drift.
- **Transient Isolation Boundary**: Intermediate agent scratchpads, raw terminal dumps, and temporary logs (`.scratch/`, `scratch/`, `tmp/`) must remain strictly isolated from git tracking and markdown linting pipelines (`npm run lint:docs`). Curated agent skills in `.agents/skills/` remain tracked configuration.
- **Dual Spec Exposure**: Co-locate machine-readable `openapi.json` at root for automated tooling/CI with human-readable markdown in `docs/` and `adr/` for GitHub-native developer navigation.
- **Pre-PR Staging & Gate Invariant**: Prior to publishing a feature branch or opening a pull request, run the complete verification suite (`npm run quality` and `npm test`). Ensure zero lint warnings, zero documentation drift, and that all architectural invariants pass cleanly.

### 10. Continuous Accessibility (a11y) & WCAG 2.1 Conformance

- All public pages, interactive modals, drawers, and forms must maintain strict WCAG 2.1 Level AA compliance with zero Critical, Serious, or Moderate axe-core violations.
- Root layout (`app/layout.tsx`) must provide a visible-on-focus `<SkipToContent />` link targeting `<main id="main-content" tabIndex={-1}>`, alongside the global screen reader live announcer provider (`A11yProvider`).
- Interactive modal containers and mobile navigation drawers must enforce focus trapping (`useFocusTrap`) with Escape dismissal and focus restoration to the originating trigger.
- Canvas-driven experiences (games, 3D brain simulator, proof DAGs) must supply accessible fallback descriptions and keyboard-navigable controls.

### 11. Defect Remediation & Root-Cause Regression Invariant

- All bug fixes and defect remediations across core computational engines (`lib/proof-utils.ts`, `lib/garmin-engine.ts`, `lib/working-with-duck-engine.ts`, `lib/crf/ast-evaluator.ts`) must follow the strict Red-Green Remediation Protocol.
- Every patch must include an isolated reproduction test in `__tests__/` verifying pre-fix failure and post-fix success, backed by regression test coverage in `__tests__/defect-remediation-regression.test.ts`.
- Core calculation and state engines must enforce boundary defenses against division-by-zero, cyclic AST references, and out-of-bounds inputs with zero unhandled crash vectors.

### 12. Proactive Defect Interception & Synthetic Reliability

- Core deterministic logic and security sanitization modules must maintain property-based fuzz tests (`__tests__/property-fuzz.test.ts`) and pass fast-check property fuzzing gates.
- Critical user journeys (Landing Pretext layout, Command Palette discovery, Proof DAG studio, Arcade canvas lifecycles, and API telemetry ingestion) must be verified via Playwright synthetic user probes (`__tests__/e2e/synthetic-probes.spec.ts`) and monitored continuously via scheduled crons (`.github/workflows/synthetic-probes.yml`).
- In Playwright synthetic user probes and end-to-end browser tests, interactive UI triggers (e.g. Command Palette search buttons, mobile navigation triggers, modal openers) must be wrapped in `expect(async () => { ... }).toPass({ timeout: 15000 })` polling blocks to prevent hydration race conditions where clicks land on static HTML before React 19 event listeners attach.
- Modals and animated drawers hosted in `<AnimatePresence>` must specify an explicit `key` prop (e.g. `key="command-palette-modal"`) on their outermost container to ensure deterministic presence tracking during fast multi-browser headless evaluation.
- Arcade canvas probes targeting `/arcade/*` must interact with the `<PlayCabinet>` launch workflow (`getByRole("button", { name: /Launch Cabinet/i }).click()`) and allow for CRT warmup before asserting `<canvas>` context availability.
- Canary analysis (`scripts/canary-analyzer.ts`, `npm run canary:eval`) is manual tooling that evaluates caller-supplied metric windows against hard SLA limits (5xx error rate <= 0.5%, p95 latency <= 800ms, Sentry exception spike ratio <= 2.0x). Nothing invokes it automatically, and nothing in the repository promotes or rolls back a deployment: during the manual hold, an operator starts Production from the Vercel Dashboard after Merge Gate passes; keep this hold until a replacement release policy is approved and verified ([ADR 0051](adr/0051-manual-production-releases.md), `DEPLOYMENT.md`). Rollback is a person using Vercel's Instant Rollback.

### 13. Layout Integrity, Defensive CSS & Stacking Context Isolation

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

### 14. Continuous Real-Browser Page Benchmarking & Web Vitals Profiling

- Any new first-class route, case study, or interactive mini-game must be registered in `CANONICAL_ROUTES` in `lib/dx/page-bench.ts`.
- Real-browser navigation timing and Core Web Vitals (TTFB, FCP, LCP, CLS) must be benchmarked against production builds via `npm run bench:pages` or `npx tsx scripts/benchmark-pages.ts`.
- In CI and pre-release gates, performance budgets can be enforced via `--assert` / `--budget` flags, ensuring fleet median LCP <= 2500ms, TTFB <= 800ms, and CLS <= 0.1.

### 15. Developer Experience (DX), Git Hygiene & Tooling Integrity

- Runtime environment variables must be declared in `lib/env.ts` and synchronized with `.env.example` via `npm run dx env` and `npm run doctor:fix`.
- All commit messages must strictly adhere to the Conventional Commits specification (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `dx`), verified by `.husky/commit-msg` (`scripts/validate-commit-msg.ts`) and supported by `npm run dx commit`.
- Git branches must follow naming conventions (`feat/*`, `fix/*`, `chore/*`, `refactor/*`, `docs/*`, `perf/*`, `dx/*`, `test/*`, `dev/*`, `jules/*`, `main`, `dev`). `jules/*` is reserved for branches the Jules agent opens; `dev` is reserved for the temporary consolidation release documented in [ADR 0050](adr/0050-jules-consolidation-release.md). Steady-state feature pull requests target `main`; the branch list is `validateBranchName()` in `lib/dx/git-guard.ts`, and agents must not edit the guard to get a branch through.
- **Git Safety Guardrails & Protected Branch Invariant**: Destructive git commands (`git push --force`, `git push --force-with-lease`, `git push origin main`, `git reset --hard`, `git clean -f/-fd`, `git branch -D`, `git checkout .`, `git restore .`) are intercepted and blocked across agent tool runners and local CLI sessions by `scripts/git-guardrail.sh` (exit code 2) and `.husky/pre-push`. Direct pushes to `main`, remote branch deletions, and non-fast-forward branch updates are prohibited to preserve PR governance and shared history. Explicit emergency override requires `ALLOW_DANGEROUS_GIT=1`. The guardrail matches per command segment, anchored to each segment's leading program and ignoring quoted spans, so inspecting, testing or documenting a pattern is never mistaken for performing it; a guard that cannot be read without the bypass is one operators learn to bypass reflexively.
- **Consequential Deploy Interception**: `scripts/git-guardrail.sh` intercepts CLI Production deploy and promotion commands until an approved replacement release policy is verified; use Vercel Dashboard → Deployments → Create Deployment for the current green `main` SHA ([ADR 0051](adr/0051-manual-production-releases.md)). It also intercepts `vercel deploy --prebuilt`, `vercel env rm`, `vercel domains rm` and `prisma migrate deploy`. `--prebuilt` is the sharpest: it ships a locally built artifact without rebuilding, so a build whose data source was unreachable deploys fallback content over real content. Other guards are skipped when `CI=true`, where deliberate automation carries its own verification, and share the single `ALLOW_DANGEROUS_GIT=1` override rather than introducing a variable per command.
- **Branch Naming Enforcement**: `.husky/pre-push` runs `scripts/validate-branch.ts` before the protected-branch guard, and `.husky/post-checkout` warns (never blocks) at creation time, when renaming is still free. Failures name `npm run dx branch`.
- **Early Fail-Fast Pre-Commit Pipeline**: `.husky/pre-commit` executes `lint:boundaries` immediately after `typecheck`, then `check-docs-drift`, both prior to `test:staged` and `audit:security`. Documentation drift is the most frequent and cheapest-to-detect failure, so discovering it after the staged suite cost two full pre-commit cycles on every public-export change. Drift failures print the exact command that resolves them, branched by category; generated references are never auto-staged, because authored documentation is edited deliberately and silently restaging it would discard that intent.
- **Standard Developer Workflow**: `main` is the sole long-lived integration and release branch. Cut short-lived prefixed feature and agent branches from `main`, then squash-merge their pull requests into `main` after the required CI gates pass. The `dev` branch was a one-time Jules consolidation exception ([ADR 0050](adr/0050-jules-consolidation-release.md)); it merged in #1029 and no longer exists, so do not recreate it for new feature work. CI runs for pull requests targeting `main` and on `main` pushes. Keep automatic non-production Vercel deployments disabled unless an operator deliberately requests one preview. Keep all Vercel Git deployment triggers disabled throughout the manual hold. After the PR's Merge Gate is green and merged, an operator starts Production from Vercel Dashboard → Deployments → Create Deployment using the current `main` commit; the Vercel build migrates and builds, and Deployment Checks must pass before the domains move. End the hold only after a replacement ADR is approved, its implementation passes required CI, and an operator verifies the release trigger; the nightly proposal is tracked in #1168 (temporary policy: [ADR 0051](adr/0051-manual-production-releases.md)). GitHub Actions runs CI and never deploys, so production secrets live only in Vercel. Migrations remain expand/contract. The Dashboard's Redeploy rebuilds the commit it is pressed on; use Create Deployment with the current `main` SHA to ship a merge.
- **Pull Request Publication Protocol**: When publishing feature branches via GitHub CLI (`gh pr create`), author structured descriptions that cross-link relevant Architectural Decision Records (`adr/00XX-*.md`), summarize key architectural changes, and report test validation metrics.
- Dead code and orphaned exports must be inspected via `npm run dx dead-code` and monitored in `lib/dx/doctor.ts`. Private helper functions, props interfaces, and internal sub-components in `components/` and `app/` must not use `export` unless consumed across modules, while `lib/`, `types/`, and `hooks/` constitute public TypeDoc contract entrypoints.
- Build-time static generation and offline fallbacks (such as dummy database connections or rate-limited GitHub stats) must gate console warnings on **runtime rather than production**, using `env.VERCEL_ENV === "production" && !isBuildPhase()` from `lib/env.ts`. A production build also runs with `VERCEL_ENV=production`, so a production check alone leaves the gate open throughout static compilation: one build then emits a warning per page per worker, which is the stderr noise this invariant exists to eliminate. `isBuildPhase()` identifies prerendering via `NEXT_PHASE` and the end-to-end harness via `PLAYWRIGHT_TEST`, and is the single definition of that distinction.
- Production bundle chunks and initial shared footprints must comply with performance budgets via `npm run dx analyze` and `lib/dx/bundle-guard.ts`.
- VS Code workspace configurations (`.vscode/`) and `.editorconfig` must remain valid and intact.

### 16. Mobile Runtime Performance & Animation Invariants

- **Background Animation Throttling**: Background SVG and particle canvas animations (e.g. `AnimatedGridPattern`, collision beams) must use hardware-accelerated CSS keyframes on mobile viewports (`< 768px`) or be clamped to static composited loops. They must never trigger continuous React `setState` updates or loop `onAnimationComplete` callbacks in mobile render trees.
- **GPU Blur & Compositing Bounds**: Heavy gaussian blur layers (`blur-[100px]` or greater) and overlapping multi-layer `backdrop-blur` filters must be suppressed or substituted with lightweight CSS radial gradients (`hidden sm:block` or responsive classes) on mobile devices to prevent GPU rasterization stalls during scrolling.
- **ResizeObserver Dimension Isolation**: Dynamic text layout engines and Pretext observers must isolate width measurements (`Math.floor(contentRect.width)`) from height fluctuations to prevent mobile browser URL bar / address-bar collapse during scrolling from triggering unnecessary canvas text layout recalculations.
- **Touch & Synthesizer Isolation**: Synthesized Web Audio effects tied to mouse cursor movement (such as hover frequencies) must defensively check `window.matchMedia('(hover: none)').matches` to avoid unwanted audio thread contention during mobile touch-scrolling. Interactive touch buttons and cards must supply instant tactile scaling (`active:scale-[0.98]`).

### 17. Brand Assets, Headless SVG Rasterization & Satori OpenGraph Invariants

- **Headless SVG Rasterization Fallbacks**: SVGs consumed by Node.js build pipelines, `sharp`, or `librsvg` must define explicit inline presentation attributes (`fill="..."`, `stroke="..."`) on geometry elements in addition to CSS class styles, preventing unparsed CSS custom properties from rasterizing as solid black silhouettes.
- **Satori (`next/og`) Layout Flow**: Dynamic `ImageResponse` social card generators (`lib/og-image.tsx`, `app/**/opengraph-image.tsx`) must avoid `zIndex` properties, relying strictly on flexbox and natural DOM document order for ambient glow and card stacking.
- **Asset Hygiene & PWA Manifest Parity**: Default boilerplate assets (`vercel.svg`, `next.svg`, `file.svg`, `globe.svg`, `window.svg`, default 25KB placeholder `favicon.ico`) must be removed, maintaining dedicated multi-size binary ICOs (16/32/48px), Apple Touch icons (180x180), PWA icons (192/512px), and dynamic `app/manifest.ts` metadata synchronization.

### 18. Canonical Domain, Base URL & Production Routing Invariant

- **Single Source of Truth**: All canonical URLs, `metadataBase`, dynamic sitemaps (`app/sitemap.ts`), robots directives (`app/robots.ts`), OpenGraph preview metadata, and Schema.org JSON-LD structured data generators (`lib/seo.ts`) must resolve via `resolveBaseUrl()` in `lib/domain.ts` and `SITE_BASE_URL` in `lib/seo.ts`.
- **Production Domain Parity**: The canonical production domain is strictly `https://deruiter.dev` (the apex, matching Vercel's primary domain routing; `www.deruiter.dev` issues a `308` to it at the edge). Route entrypoints, error layouts (`components/UnifiedErrorLayout.tsx`, `app/error.tsx`), and social generators must never hardcode temporary `.vercel.app`, `fderuiter.dev`, or the non-canonical `www` host.
- **Dynamic Preview & Clipboard Isolation**: Runtime origin is scoped strictly to link sharing. `getActiveHostUrl()` in `lib/clipboard.ts` may read `window.location.origin` in active browser runtimes; `resolveBaseUrl()` must never do so, so that canonical tags, sitemaps, JSON-LD and OpenGraph metadata are byte-identical whether rendered on the server or in the browser. Headless SSR fallbacks and test harnesses validate deterministically against `https://deruiter.dev`.

### 19. Studio Container Theming & Scoped Design Tokens

- **Container-Level Scoping**: Interactive studio suites and simulators (CRF Studio, Proof Canvas, Neuro Simulator) offering independent light/dark modes must apply themes via container data attributes (`[data-studio-theme="light"]` / `[data-studio-theme="dark"]`) and CSS custom property cascades (`--crf-bg`, `--crf-surface-1`, `--crf-border`, etc.) rather than mutating the root `<html>` element. This preserves the surrounding portfolio's architectural frame, global navbar, and route landmarks.
- **State Persistence & URL Sync**: Studio-level theme preferences must default to dark mode for portfolio consistency, persist in `localStorage`, and synchronize cleanly with URL hash parameters (`#theme=light`) using `useStudioHashParams`.

### 20. Scientific & Engineering Editorial & Zero-Trope Invariant

- **Prohibition of Generic AI Design Tropes**: The visual system strictly prohibits generic AI portfolio clichés:
  - No continuous main-thread or canvas collision particle loops (e.g. Aceternity falling beams).
  - No diffuse, uncontained neon glow washes or purple-on-dark aesthetics.
  - No icon-stuffed bento cards lacking functional telemetry.
- **High-Assurance Architectural Palette**: All surface backgrounds and cards must use warm architectural graphite (`#0d0e11`, `#13151a`), high-contrast text (`#f4f4f6`), and crisp hairline structural micro-borders (`rgba(255, 255, 255, 0.08)` / `border-zinc-800`).
- **Functional Semantic Status Accents**: Status indicators, telemetry badges, and interactive feedback must use crisp semantic tokens (Precision Amber `#f59e0b`, Emerald `#10b981`, Steel `#94a3b8`) rather than decorative gradients.
- **Swiss Editorial Typography & Layout**: High-impact headlines must utilize negative tracking (`-0.035em`) paired with zero-CLS Pretext calculations, and technical metadata must utilize tabular monospace (`var(--font-geist-mono)`).
- **Scoped Arcade-Cabinet Exception**: Inside a launched `PlayCabinet`, a game may use saturated accents, glow, screen shake and CRT/scanline effects during discrete, event-driven _loud moments_ such as score resolution, a Blind cleared or failed, or a boss intro. The effects must be scoped to a cabinet attribute (Trial & Error uses `[data-te-cabinet][data-te-loud="on"]` with `--te-*` tokens), disabled under `prefers-reduced-motion` and below 768px, and animate only `transform` and `opacity`. Continuous particle loops, purple-on-dark washes, and any effect outside the cabinet remain prohibited. Governed by the [ADR 0046 card-table amendment](adr/0046-trial-and-error-biostat-ops-architecture.md#amendment-2026-09-23-card-table-presentation).
- **Interactive Telemetry Over Static Cards**: Major technical showcases and dedicated studio pages (`/proof`, `/crf`, `/simulator`) must provide interactive micro-simulations (AST premise discharging, CDISC 21 CFR Part 11 auditing, embedded memory heap meters) with direct contextual handoffs to full studio workspaces.

### 21. TS Deep Modules & Architectural Seam Enforcement

- Modules in `lib/` (e.g. `lib/crf/`, `lib/laser-loon/`, `lib/neuro/`, `lib/retro-labyrinth/`, `lib/arcade/`, `lib/clinical-trial-chaos/`) are deep modules: root entry points (`index.ts`, `types.ts`, `presets.ts`) constitute the only public contract. See [lib/README.md](./lib/README.md).
- Subfolder internals (`lib/**/internal/*`, `lib/**/core/*`, `lib/**/presets/*`) are strictly private to their owning module.
- Unit tests (`__tests__/`) and external components (`app/`, `components/`) must import exclusively through public root entry points.
- Zero circular dependencies are permitted across the repository, enforced deterministically via `npm run lint:boundaries` and `npm run verify`.
- The invariant also holds one layer down, between the webpack runtime chunks `npm run build` emits, which `dependency-cruiser` cannot see. A Web Worker created with `new Worker(new URL("./x.ts", import.meta.url))` gets its own runtime chunk, so a worker whose import graph reaches the module that constructs it makes its chunk start itself (#853). `ChunkCycleGuardPlugin` (`lib/dx/chunk-cycle-guard.ts`, registered in `next.config.ts`) fails the build on any such cycle instead of letting webpack warn, and `__tests__/chunk-cycle-guard.test.ts` checks worker import graphs statically. Break the reference, e.g. by having the worker import the computation directly rather than the module that offloads it; never add the warning to `ignoreWarnings`.

### 22. Free-Tier Provider Quota Governance & Edge Offloading

- **Zero-Cost Free-Tier Ceiling**: All application architecture, scheduled jobs, and telemetry pipelines must operate strictly within the zero-cost free-tier entitlements of external providers (Vercel Hobby, Neon Postgres 0.5 GiB, Upstash Redis 10k commands/day, Resend 100 emails/day, Sentry 5k errors / 10k spans/mo, Clerk 10k MAU). Governed by [ADR 0036](adr/0036-free-tier-offloading-and-provider-quota-governance.md).
- **GitHub Actions Resource Governance**: GitHub currently reports this repository as public. Standard GitHub-hosted runner minutes are free for public repositories; larger runners and artifact/cache storage have separate billing. Keep `timeout-minutes` bounds, standard runner labels, and the no-duplicate-gating rule as reliability and cost safeguards. GitHub branch protection and rulesets are available for public repositories, but their current configuration still requires dashboard verification tracked by #732; local hooks remain defense-in-depth. Governed by [ADR 0039](adr/0039-github-pro-plan-capabilities-and-actions-minutes-governance.md).
- **Database Compute Sleep Invariant**: Neon serverless Postgres compute auto-suspends after 5 minutes of inactivity. Public browsing routes must never query Neon directly per request: full-page editorial content must use Next.js Incremental Static Regeneration (ISR with `revalidate = 3600`) at the edge, dynamic reads must pass through Upstash Redis read-through caching (`CaseStudyService`), and visitor interaction counters (reactions, pageviews) must be buffered in Redis (`HINCRBY`) rather than waking Postgres per click.
- **Fallback Content Is Runtime-Only**: The static fallbacks that keep pages serving while Neon is suspended must never be baked into a deployment. A production build whose database or cache is unreachable must exit non-zero via `failBuildOnDataSourceError()` in `lib/build-integrity.ts` rather than substituting fallback content and reporting success, because `--prebuilt` deploys the artifact without rebuilding it. A query that succeeds and returns no rows is not a failure; a cache miss is not a data-source failure and must continue to fall through to the database. `ALLOW_FALLBACK_PRODUCTION_BUILD=1` is the deliberate, logged emergency override.
- **Upstash Daily Command Protection**: To prevent exhausting Upstash's 10,000 commands/day allowance, `@upstash/ratelimit` instances must configure local in-memory caching (`ephemeralCache`), multi-key operations must use `redis.pipeline()`, and rate-limiting must be restricted strictly to mutative routes (`/api/contact`, `/api/newsletter`, `/api/telemetry`), completely bypassing static GET assets.
- **Unified Maintenance Pipeline (Vercel Hobby 1-Cron Limit)**: Because Vercel Hobby permits strictly one cron job per day (`0 0 * * *`), all background tasks (telemetry buffer syncing, outbound email retries, and retention rollups) must be consolidated into a single time-budgeted maintenance route (`/api/cron/maintenance`) executing within $\le 8$ seconds. Sub-daily email retries may optionally use external event-driven webhooks via Upstash QStash.
- **Sentry Quota & Noise Bounds**: `tracesSampleRate` must resolve dynamically to 0% in preview, development, and testing, and be clamped to $\le 5\%$ (0.05) in production. `beforeSend` filters must drop benign client noise (`AbortError`, `ResizeObserver loop limit exceeded`, browser extension errors) and strip all PII and authorization headers.
- **External Agent Review Brief Standard**: All integration, devops, and feature tickets authored for review or execution by external AI agents (Claude Code, OpenAI) must include an explicit `## Agent Review Brief` specifying:
  1. Exact file paths and symbols to inspect.
  2. Invariant boundaries (non-destructive execution, quota caps, environment namespacing).
  3. Actionable terminal verification commands (`npm test`, `npm run verify:*`, `npm run check-docs-drift`, `npm run quality`).

## Agent skills

### Issue tracker

GitHub issues managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles matching standard label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository using `CONTEXT.md` and `adr/` at root. See `docs/agents/domain.md`.
