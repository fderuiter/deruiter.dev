# AGENTS.md sections 1 to 4: Tests, layout, route discovery and React

The full text of [AGENTS.md](../../../AGENTS.md) sections 1 to 4, with the reasons behind each rule. AGENTS.md keeps one line per rule; this page keeps why. Section numbers match AGENTS.md.

## 1. Test Environment & Path Resolution

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

## 2. Layout & Component Hierarchy

- `app/layout.tsx` renders the global `<Navbar />` and top-level providers (`AudioProvider`, `SearchProvider`).
- Route pages (e.g. `app/proof/page.tsx`, `app/simulator/page.tsx`, `app/schedule/page.tsx`, `app/stack/page.tsx`, `app/work/laser-loon/page.tsx`) must never render a secondary `<Navbar />` component.
- Route entrypoint files (`app/**/page.tsx`) must directly declare root header clearance padding (`pt-24` to `pt-32` or `min-h-screen`/`min-h-dvh` or `<PageLayout />`) to satisfy static DX Doctor invariant audits.

## 3. Route Indexing & Discovery

- Any new first-class route or interactive tool must be synchronized across the 5-Point Discovery Matrix:
  - `STATIC_NAVS` in `lib/command-palette/static-navs.ts` (rendered by `components/CommandPalette.tsx`), with a Tabler icon name, status badge, tech stack tags and preview highlights.
  - `lib/navigation.ts`, the single data source for the top bar, desktop menus, mobile drawer and footer columns (one entry under the right group, per [ADR 0058](../../../adr/0058-site-navigation-information-architecture.md)).
  - `app/sitemap.ts` and `lib/seo-metadata.ts` under `ROUTE_METADATA_CONFIGS` with canonical path and change frequency.
  - `app/<route>/opengraph-image.tsx` providing a 1200x630 dynamic social preview card matching the systems architecture design system (`lib/og-image.tsx`).
  - `PUBLIC_ROUTE_REGISTRY` in `lib/public-routes.ts`, which feeds `CANONICAL_ROUTES` in `lib/dx/page-bench.ts` (see invariant 14).
- An arcade game is also registered in `ARCADE_REGISTRY` (`lib/arcade/registry.ts`) with its listing and per-view readiness ([ADR 0062](../../../adr/0062-three-views-per-arcade-game.md)); DX Doctor's `routes-arcade-registry-parity` check fails when a registry route is missing from the sitemap metadata, the public route registry or the Command Palette.

## 4. Hydration & React Best Practices

- For client-only rendering or browser API reads, prefer `useSyncExternalStore` over `useEffect` + `useState` hydration flags.
- Keep hook dependency arrays exhaustive across all hooks and memoized callbacks (`useCallback`, `useMemo`) to satisfy React 19 compiler optimization rules (`react-hooks/preserve-manual-memoization`).
- Declare all helper functions and event handlers prior to any `useEffect` blocks that invoke them to prevent temporal-dead-zone immutability errors.
- When synchronizing URL hash or query parameters into component state on mount, use direct derivation where possible or annotate necessary synchronous `setState` calls with `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- Dynamic values that vary between server and client render (e.g. `toLocaleTimeString()`, timestamps, random IDs) must include `suppressHydrationWarning` on the host element or be rendered strictly after mounting.
- When updating external stores, localStorage, or URL hash parameters (e.g. `useStudioHashParams().setParam`), never dispatch mutations or trigger window events synchronously inside functional `setState((prev) => ...)` updater callbacks. Compute the next state value and invoke external store/hash mutations as distinct sequential operations in event handlers or `useEffect` blocks to prevent "Cannot update a component while rendering a different component" execution errors.
