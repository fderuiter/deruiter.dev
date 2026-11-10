<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Architectural & Testing Invariants

One line per rule. The reasons, examples and incident history behind each section are in [`docs/agents/invariants/`](docs/agents/invariants/README.md), under the same section numbers.

### 1. Test Environment & Path Resolution

- Never hardcode root paths such as `/app` in tests or scripts; resolve the root with `process.cwd()` or `path.resolve(__dirname, '..')`.
- Mock and isolate `globalThis.localStorage` with a standard `MockStorage` when testing browser storage.
- Pass `--no-warnings` in `execArgv` on Node 25+. Keep Vitest configs as `.mts` files using `import.meta.dirname`; never reintroduce `VITE_CONFIG_NATIVE_IGNORE_WARNING` or a `.ts` config (#1368).
- Keep `vitest.setup.ts`, benchmark CLIs (`lib/dx/page-bench.ts`) and type-only barrels (`lib/*/types.ts`, `lib/*/index.ts`) in `coverage.exclude`.
- Check `typeof window.localStorage?.getItem === "function"` and `typeof window.localStorage?.setItem === "function"` before touching storage in production hooks and store subscribers.
- Skip reading `.env` files when `process.env.VITEST` is set (`lib/env.ts` and `scripts/build.js` are the reference), so real credentials never reach test output (#865).
- Remove unused imports in tests and prefer `const` over `let`.
- Give any test that renders JSX the `.test.tsx` extension.
- Type a mocked `this` as `this: Record<string, unknown>` or a mock interface, never `this: any`.

### 2. Layout & Component Hierarchy

- `app/layout.tsx` renders the global `<Navbar />` and the top-level providers (`AudioProvider`, `SearchProvider`).
- Never render a second `<Navbar />` from a route page.
- Declare header clearance (`pt-24` to `pt-32`, `min-h-screen`/`min-h-dvh`, or `<PageLayout />`) directly in each `app/**/page.tsx`.

### 3. Route Indexing & Discovery

- Register every new first-class route or tool in all five discovery points:
  - `STATIC_NAVS` in `lib/command-palette/static-navs.ts` (rendered by `components/CommandPalette.tsx`), with a Tabler icon name, status badge, tech stack tags and preview highlights.
  - `lib/navigation.ts`, one entry under the right group ([ADR 0058](adr/0058-site-navigation-information-architecture.md)).
  - `app/sitemap.ts` and `ROUTE_METADATA_CONFIGS` in `lib/seo-metadata.ts`.
  - `app/<route>/opengraph-image.tsx`, a 1200x630 card built on `lib/og-image.tsx`.
  - `PUBLIC_ROUTE_REGISTRY` in `lib/public-routes.ts` (see section 14).
- Also register an arcade game in `ARCADE_REGISTRY` (`lib/arcade/registry.ts`) with its listing and per-view readiness ([ADR 0062](adr/0062-three-views-per-arcade-game.md)).

### 4. Hydration & React Best Practices

- Prefer `useSyncExternalStore` over `useEffect` + `useState` flags for client-only reads.
- Keep every hook dependency array exhaustive (`react-hooks/preserve-manual-memoization`).
- Declare helpers and handlers before the `useEffect` blocks that call them.
- Derive URL hash or query state directly; annotate an unavoidable synchronous `setState` with `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- Put `suppressHydrationWarning` on elements whose values differ between server and client, or render them after mount.
- Never mutate external stores, `localStorage` or the URL hash inside a `setState((prev) => ...)` updater; compute the value, then mutate in a handler or effect.

### 5. Multi-Agent Integration & Invariant Synthesis

- Resolve merge conflicts additively: never drop features, nest providers in order (`PersonaProvider` -> `TerminologyProvider` -> `SearchProvider`), keep rich text tokens and tooltips, and give standalone tests safe defaults.
- Never commit agent logs, scratchpads (`.scratch/`, `scratch/`, `tmp/`) or ad-hoc scripts. `.agents/skills/` is tracked configuration.

### 6. Developer Suite (DX) & Quality Invariants

- Run `npm run quality` (or `npm run verify`) before a PR: types, zero ESLint warnings, docs and every DX Doctor invariant.
- Create new games, APIs, ADRs, case studies and components with `npm run scaffold <type> <name>`.
- Run `npm run check-docs-drift` when a public signature changes (section 9).

### 7. Headless Canvas 2D & DOM Observer Testing Lifecycle

- Keep the Canvas 2D mock in `vitest.setup.ts` complete: curve and stroke methods, real `ImageData` buffers (`width * height * 4`) and a `measureText` stub.
- Mock `ResizeObserver` and `IntersectionObserver` before rendering components that use them.
- Mock classes called with `new` using a regular function or an ES6 class, never an arrow function.
- Cancel timers and animation frames in `afterEach`.
- Stub heavy canvas and WebGL components (`RetroLabyrinth`, `Brain3DViewer`) in recovery and error-boundary tests.
- Keep `execArgv: ['--max-old-space-size=4096']` in `vitest.config.mts`, and run staged tests with `vitest related --run --passWithNoTests`.

### 8. JSDoc & TypeDoc Markdown Formatting

- In JSDoc on exported symbols, avoid numbered prefixes (`1. ...`) and raw JSX or HTML tags (markdownlint MD029, MD033).
- Re-export every interface a facade's public functions reference, so TypeDoc compiles with zero warnings.

### 9. Specification & API Documentation Synchronization

- Treat API routes, `lib/`, `hooks/` and `types/` exports, `adr/` and `ARCHITECTURE.md` as one synchronized contract.
- Declare a Zod schema in `lib/schemas.ts` for every HTTP route; `scripts/generate-openapi.ts` must cover 100% of `app/api/**/route.ts`.
- Never commit the TypeDoc reference in `docs/reference/api/`; it is git-ignored ([ADR 0023](adr/0023-diataxis-documentation-architecture-and-zero-drift-governance.md)).
- Run `npm run check-docs-drift` before committing. Pre-commit and CI both run it and fail on a TypeDoc warning, unstaged authored docs or an undocumented route.
- After changing an API route, run `npm run doctor:fix` and stage `openapi.json` with the code. Stage authored markdown you edit under `docs/`.
- Keep scratchpads and logs out of git and out of `npm run lint:docs`.
- Keep `openapi.json` at the root and human-readable docs in `docs/` and `adr/`.
- Before publishing a branch, run `npm run quality` and `npm test`.

### 10. Continuous Accessibility (a11y) & WCAG 2.1 Conformance

- Keep every public page, modal, drawer and form at WCAG 2.1 AA with zero Critical, Serious or Moderate axe violations.
- Keep the visible-on-focus `<SkipToContent />` link to `<main id="main-content" tabIndex={-1}>` and the `A11yProvider` announcer in `app/layout.tsx`.
- Trap focus in modals and mobile drawers (`useFocusTrap`), close on Escape, and restore focus to the trigger.
- Give canvas experiences accessible descriptions and keyboard controls.

### 11. Defect Remediation & Root-Cause Regression Invariant

- Fix bugs in the core engines (`lib/proof-utils.ts`, `lib/garmin/engine.ts`, `lib/working-with-duck-engine.ts`, `lib/crf/internal/ast-evaluator.ts`) red-green.
- Add a reproduction test in `__tests__/` and a regression case in `__tests__/defect-remediation-regression.test.ts` with every fix.
- Guard core engines against division by zero, cyclic ASTs and out-of-bounds input.

### 12. Proactive Defect Interception & Synthetic Reliability

- Keep fast-check property tests (`__tests__/property-fuzz.test.ts`) on core deterministic and sanitization modules.
- Cover critical journeys in `__tests__/e2e/synthetic-probes.spec.ts`, run on a schedule by `.github/workflows/synthetic-probes.yml`.
- Wrap UI triggers in Playwright tests in `expect(async () => { ... }).toPass({ timeout: 15000 })`.
- Give the outermost container of every `<AnimatePresence>` modal or drawer an explicit `key`.
- In `/arcade/*` probes, click **Launch Cabinet** in `<PlayCabinet>` and wait for the CRT warmup before checking the `<canvas>`.
- Canary analysis (`npm run canary:eval`) is manual tooling. Nothing in the repository promotes or rolls back a deployment; rollback is a person using Vercel's Instant Rollback ([ADR 0063](adr/0063-weekly-release-train.md)).

### 13. Layout Integrity, Defensive CSS & Stacking Context Isolation

- Wrap route pages in `<PageLayout />` or declare `min-h-dvh` and `overflow-x-hidden`, with no nested `<main>`.
- Use flexible heights (`min-h-*`, `h-auto`), not fixed ones, on containers holding text.
- Give flex and grid children holding text `min-w-0`.
- Isolate layered sections (`.section-isolate`) and keep z-index between `-z-10` and `z-50`.
- Use container queries (`@container`, `@sm:`, `@md:`) inside cards and widgets.
- Size SVG and canvas workspaces fluidly (`w-full`, `w-[100cqw]`, `ResizeObserver`), never with rigid minimum widths; scale guides such as `maxGuideX` to the wrapper.
- Scope studio theme variants with `--crf-*` variables and `[data-studio-theme]` cascades in `app/globals.css`.
- Verify text expansion, unbroken URLs and 200% zoom in `__tests__/defensive-css-stress.test.tsx` and `lib/dx/doctor.ts`.
- Use `querySelectorAll` with an index or test IDs when several elements share a utility class.
- Validate layout at 320px, 375px, 768px and 1440px, at 200% zoom, with the overflow detector in `__tests__/e2e/visual.spec.ts`, and on real devices.

### 14. Continuous Real-Browser Page Benchmarking & Web Vitals Profiling

- Register every new first-class route in `PUBLIC_ROUTE_REGISTRY` (`lib/public-routes.ts`); `CANONICAL_ROUTES` derives from it.
- Benchmark production builds with `npm run bench:pages`.
- Enforce budgets with `--assert` / `--budget`: fleet median LCP <= 2500ms, TTFB <= 800ms, CLS <= 0.1.

### 15. Developer Experience (DX), Git Hygiene & Tooling Integrity

- Declare runtime environment variables in `lib/env.ts` and sync `.env.example` with `npm run dx env` and `npm run doctor:fix`.
- Write Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `dx`).
- Name branches with an allowed prefix (`validateBranchName()` in `lib/dx/git-guard.ts`); never edit the guard to get a branch through. `jules/*` is for Jules and `dev` was the one-time [ADR 0050](adr/0050-jules-consolidation-release.md) branch.
- Never run destructive git commands (force push, push to `main`, `reset --hard`, `clean -f`, `branch -D`, `checkout .`, `restore .`); `scripts/git-guardrail.sh` and `.husky/pre-push` block them. The override is `ALLOW_DANGEROUS_GIT=1`.
- Never deploy or promote Production from a CLI, and never run `vercel deploy --prebuilt`, `vercel env rm`, `vercel domains rm` or `prisma migrate deploy`.
- `main` is the only long-lived branch. Cut short-lived branches from it and squash-merge PRs after required CI passes.
- Merging never deploys. Production ships through the weekly release train ([ADR 0063](adr/0063-weekly-release-train.md)), and GitHub Actions runs CI and never deploys.
- Only the operator changes `WEEKLY_TRAIN`, the deploy hook secret or a `release:hold` label.
- Cross-link ADRs, summarize the change and report test results in PR descriptions.
- Check dead code with `npm run dx dead-code`. Do not export private helpers from `components/` or `app/`.
- Gate build-time fallback warnings on `env.VERCEL_ENV === "production" && !isBuildPhase()`.
- Keep bundle chunks within budget (`npm run dx analyze`, `lib/dx/bundle-guard.ts`).
- Keep `.vscode/` and `.editorconfig` valid.

### 16. Mobile Runtime Performance & Animation Invariants

- Below 768px, run background animations as CSS keyframes or static loops, never as React `setState` loops.
- Suppress heavy blur (`blur-[100px]` and up) and stacked `backdrop-blur` on mobile.
- Measure only width (`Math.floor(contentRect.width)`) in text layout observers.
- Check `window.matchMedia('(hover: none)').matches` before playing hover sounds, and give touch targets `active:scale-[0.98]`.

### 17. Brand Assets, Headless SVG Rasterization & Satori OpenGraph Invariants

- Give SVGs used by build pipelines inline `fill` and `stroke` attributes as well as CSS classes.
- Never use `zIndex` in `next/og` image generators; rely on flexbox and document order.
- Keep boilerplate assets out, and keep the multi-size ICO, Apple Touch icon, PWA icons and `app/manifest.ts` in sync.

### 18. Canonical Domain, Base URL & Production Routing Invariant

- Resolve every canonical URL, sitemap, robots rule, OpenGraph and JSON-LD URL through `resolveBaseUrl()` (`lib/domain.ts`) and `SITE_BASE_URL` (`lib/seo.ts`).
- The canonical domain is `https://deruiter.dev`. Never hardcode `.vercel.app`, `fderuiter.dev` or `www`.
- Only `getActiveHostUrl()` in `lib/clipboard.ts` may read `window.location.origin`; `resolveBaseUrl()` never does.

### 19. Studio Container Theming & Scoped Design Tokens

- Theme studios through container attributes (`[data-studio-theme]`) and scoped variables, never by changing the root `<html>`.
- Default studio themes to dark, persist them in `localStorage`, and sync them with the URL hash through `useStudioHashParams`.

### 20. Scientific & Engineering Editorial & Zero-Trope Invariant

- No continuous particle loops, neon glow washes, purple-on-dark, or icon-stuffed bento cards.
- Use graphite surfaces (`#0d0e11`, `#13151a`), text `#f4f4f6` and hairline borders (`rgba(255, 255, 255, 0.08)` / `border-zinc-800`).
- Use the semantic accents Amber `#f59e0b`, Emerald `#10b981` and Steel `#94a3b8`, not decorative gradients.
- Track headlines at `-0.035em` and set technical metadata in `var(--font-geist-mono)`.
- Inside a launched `PlayCabinet`, loud-moment effects are allowed only when scoped to a cabinet attribute, off under `prefers-reduced-motion` and below 768px, and animating only `transform` and `opacity` ([ADR 0046 amendment](adr/0046-trial-and-error-biostat-ops-architecture.md#amendment-2026-09-23-card-table-presentation)).
- Give `/proof`, `/crf` and `/simulator` interactive micro-simulations that hand off to the full studios.

### 21. TS Deep Modules & Architectural Seam Enforcement

- Import a `lib/` module only through its root entry points (`index.ts`, `types.ts`, `presets.ts`); see [lib/README.md](./lib/README.md).
- Keep `lib/**/internal/*`, `lib/**/core/*` and `lib/**/presets/*` private to their module, in tests and components too.
- Allow no circular dependencies (`npm run lint:boundaries`).
- Never let a Web Worker's import graph reach the module that constructs it; `ChunkCycleGuardPlugin` fails the build (#853). Never add the warning to `ignoreWarnings`.

### 22. Free-Tier Provider Quota Governance & Edge Offloading

- Stay within the free tiers of every provider ([ADR 0036](adr/0036-free-tier-offloading-and-provider-quota-governance.md)).
- Keep `timeout-minutes` bounds and standard runners in GitHub Actions, and never duplicate a gate. Ruleset `main v2` requires `Merge Gate (Required Checks Summary)` and `CDISC CORE (SDTMIG 3.4, USDM 4.0)` ([ADR 0039](adr/0039-github-pro-plan-capabilities-and-actions-minutes-governance.md)).
- Never query Neon per request from a browsing route: use ISR with a daily `revalidate = 86400` backstop, Redis read-through caching and Redis-buffered counters.
- Never bake fallback content into a production build: an unreachable data source fails the build through `failBuildOnDataSourceError()` (`lib/build-integrity.ts`). The override is `ALLOW_FALLBACK_PRODUCTION_BUILD=1`.
- Give `@upstash/ratelimit` an `ephemeralCache`, batch multi-key calls with `redis.pipeline()`, and rate-limit only `/api/contact`, `/api/newsletter` and `/api/telemetry`.
- Run every background task inside the single daily `/api/cron/maintenance` route, within 8 seconds.
- Keep Sentry `tracesSampleRate` at 0 outside production and at most 0.05 in production, and drop benign noise and PII in `beforeSend`.
- Give every ticket written for an external agent an `## Agent Review Brief` with file paths and symbols, invariant boundaries, and verification commands.

## Agent skills

### Issue tracker

GitHub issues managed via the `gh` CLI. See `docs/agents/issue-tracker.md`. Hierarchy, labels, triage states and agent execution rules are in `docs/how-to/issue-governance.md`.

### Triage labels

Five canonical triage roles matching standard label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository using `CONTEXT.md` and `adr/` at root. See `docs/agents/domain.md`.

### Writing

Edit prose with the `humanizer` skill (`.claude/skills/humanizer/`), this site's version of blader/humanizer with its voice and claim rules built in. See `docs/agents/writing.md`.

### Skill folders

Canonical skills sit in `.agents/skills/`; five are bridged into `.claude/skills/` with symlinks. See `docs/agents/skill-folders.md`.
