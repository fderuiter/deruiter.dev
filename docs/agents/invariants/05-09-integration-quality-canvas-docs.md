# AGENTS.md sections 5 to 9: Integration, DX quality, canvas tests and documentation

The full text of [AGENTS.md](../../../AGENTS.md) sections 5 to 9, with the reasons behind each rule. AGENTS.md keeps one line per rule; this page keeps why. Section numbers match AGENTS.md.

## 5. Multi-Agent Integration & Invariant Synthesis

- When merging concurrent feature branches or autonomous agent PRs, always apply **Additive Synthesis** on merge conflicts: never drop features, combine context providers in topological hierarchy (e.g. `PersonaProvider` -> `TerminologyProvider` -> `SearchProvider`), preserve rich text tokens and tooltips, and provide safe fallback defaults for standalone component testing.
- Never commit intermediate agent tracking logs, temporary planning scratchpads (`.scratch/`, `scratch/`, `tmp/`), or ad-hoc adversarial scripts to project git history. Curated agent skills in `.agents/skills/` are tracked configuration.

## 6. Developer Suite (DX) & Quality Invariants

- Run `npm run quality` (or `npm run verify`) to ensure type safety, zero ESLint warnings, docs synchronization, and every architectural invariant reported by DX Doctor passes.
- When adding new games, APIs, ADRs, case studies, or components, utilize `npm run scaffold <type> <name>` to guarantee standard vertical slices (`arcade` writes a three-view game with its session and views and registers it across the discovery matrix and `ARCADE_REGISTRY`; `case-study` registers in `lib/command-palette/static-navs.ts`).
- Whenever public library or hook signatures change, run `npm run check-docs-drift`, which compiles the TypeDoc reference with warnings as errors. The compiled reference in `docs/reference/api/` is git-ignored; never commit it.

## 7. Headless Canvas 2D & DOM Observer Testing Lifecycle

- In JSDOM and unit tests for canvas-driven components (games, simulators, neuro slice viewers, Pretext text layout engines), ensure Canvas 2D mock contexts in `vitest.setup.ts` provide:
  - Full curve and stroke methods (`quadraticCurveTo`, `bezierCurveTo`, `arcTo`, `roundRect`, `strokeRect`, `clearRect`, `setLineDash`, `getLineDash`, `clip`, `ellipse`).
  - Realistic `ImageData` instances from `createImageData(w, h)` and `getImageData(sx, sy, sw, sh)` with allocated `Uint8ClampedArray` pixel buffers (`width * height * 4`).
  - Text measurement stubs (`measureText: (text) => ({ width: (text || "").length * 8, height: 16 })`).
- When rendering components or hooks utilizing `ResizeObserver` or `IntersectionObserver` in JSDOM (such as `useResizeObserver` or `PretextCard`), ensure `global.ResizeObserver` / `global.IntersectionObserver` is mocked in `beforeAll` or test setup.
- When mocking external classes or loader constructors invoked with the `new` keyword (e.g. `new OBJLoader()`, `new GLTFLoader()`, `new AudioContext()`), always provide a regular constructor function (`function (this: any) { this.load = mockLoad; }`) or ES6 class implementation in `mockImplementation` rather than an arrow function to prevent runtime `TypeError: ... is not a constructor` exceptions.
- Ensure active component timers and animation frames are unmounted/cancelled cleanly in `afterEach`.
- In unit tests verifying error boundaries, navigation fallbacks, or recovery layouts (`__tests__/unified-recovery.test.tsx`), mock heavy dynamic canvas/WebGL game components (`RetroLabyrinth`, `Brain3DViewer`) with lightweight stubs rather than executing full simulation loops in JSDOM to prevent memory leaks and unhandled worker exceptions.
- Vitest test suites must configure explicit worker heap limits (`execArgv: ['--max-old-space-size=4096']` in `vitest.config.mts`), and pre-commit staging must utilize `vitest related --run --passWithNoTests` to bound test execution scope.

## 8. JSDoc & TypeDoc Markdown Formatting

- In JSDoc comments on exported symbols, avoid numbered prefixes (e.g. `1. ...`) or raw unescaped JSX/HTML tags (e.g. `<Navbar />`), as TypeDoc converts these into markdown files subject to `markdownlint` rules `MD029` (ordered list style) and `MD033` (inline HTML).
- When re-exporting hooks or public API functions from facade files (e.g. `hooks/useAnnouncer.tsx`), ensure all referenced parameter and context interfaces (e.g. `AnnouncerContextType`) are also re-exported to maintain 100% TypeDoc extraction parity with zero compilation warnings.

## 9. Specification & API Documentation Synchronization

- **Full-Spectrum Scope**: All public API endpoints (`app/api/**/route.ts`), TypeScript library/hook exports (`lib/`, `hooks/`, `types/`), architectural decision records (`adr/`), and system architecture guides (`ARCHITECTURE.md`) are governed by automated lockstep synchronization.
- **Declarative Contracts & 100% Coverage**: All HTTP routes must declare runtime Zod validation schemas in `lib/schemas.ts`. `scripts/generate-openapi.ts` dynamically traverses `app/api/**/route.ts` to assert 100% route coverage in `openapi.json` with zero missing endpoints.
- **API Reference Is Built, Not Committed**: `npm run compile-docs` compiles TypeDoc markdown for `lib/`, `hooks/` and `types/` into `docs/reference/api/`, which is git-ignored ([ADR 0023](../../../adr/0023-diataxis-documentation-architecture-and-zero-drift-governance.md), amended 2026-10-28). Run it to browse the reference locally; there is nothing to stage.
- **Local Documentation Drift Verification**: Prior to committing changes or creating a pull request, run `npm run check-docs-drift` (or `npm run quality` / `npm run verify`) to ensure TypeDoc compiles with zero warnings, authored docs are staged, and no API route contract is missing.
- **Zero-Drift Invariant Gate**: CI (`.github/workflows/ci.yml`) executes both `npm run check-docs-drift` and `npm run verify`; pre-commit (`.husky/pre-commit`) executes `npm run check-docs-drift` (alongside `typecheck`, `lint:boundaries`, `test:staged`, and `audit:security`). Either gate fails fast (exit code 1) on a TypeDoc warning (such as a `{@link}` to an undocumented symbol), unstaged authored documentation, or undocumented API routes.
- **One-Command Auto-Remediation**: Run `npm run doctor:fix` (`npx tsx scripts/dx.ts doctor --fix`) to automatically regenerate `openapi.json` and resolve fixable architectural invariants.
- **Documentation Staging Protocol**: When adding or changing API routes, run `npm run doctor:fix` and stage `openapi.json` with the code. Stage any authored markdown you edited under `docs/`. Generated TypeDoc output is never staged.
- **Transient Isolation Boundary**: Intermediate agent scratchpads, raw terminal dumps, and temporary logs (`.scratch/`, `scratch/`, `tmp/`) must remain strictly isolated from git tracking and markdown linting pipelines (`npm run lint:docs`). Curated agent skills in `.agents/skills/` remain tracked configuration.
- **Dual Spec Exposure**: Co-locate machine-readable `openapi.json` at root for automated tooling/CI with human-readable markdown in `docs/` and `adr/` for GitHub-native developer navigation.
- **Pre-PR Staging & Gate Invariant**: Prior to publishing a feature branch or opening a pull request, run the complete verification suite (`npm run quality` and `npm test`). Ensure zero lint warnings, zero documentation drift, and that all architectural invariants pass cleanly.
