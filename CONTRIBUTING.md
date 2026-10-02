# Contributing to Portfolio Hub

Welcome! We are excited that you want to contribute to Portfolio Hub. This guide provides comprehensive setup workflows, architectural standards, feature creation rules, and instructions for using our interactive CLI scaffolding helper.

---

## 1. Context & Objectives

The primary goal of Portfolio Hub is to maintain a unified, high-performance showcase of systems engineering, machine learning engines, clinical data processors, and interactive arcade modules.

To prevent route drift, unindexed navigation entries, and architectural regression, human contributor guidelines align **100%** with automated agent rules in [`AGENTS.md`](./AGENTS.md).

### Core Standards

- **Node.js**: `>=22.0.0` (Sole supported runtime).
- **Package Manager**: `npm >= 10.0.0` (Sole supported package manager; `bun`, `yarn`, and `pnpm` are unsupported).
- **Quality Gates**: Zero TypeScript errors, zero ESLint warnings, 100% route indexing parity, zero uncommitted documentation drift.
- **Architectural Slices**: All new features must be created via the scaffolding CLI to guarantee companion test files and automatic navigation indexing across the 5-Point Discovery Matrix.

---

## 2. Developer Onboarding & Setup Workflows

### Prerequisites

Ensure Node.js 22+ and npm 10+ are installed on your system:

```bash
node -v  # Must be >= v22.0.0
npm -v   # Must be >= 10.0.0
```

Work on Linux or macOS. On Windows, clone and run the repository inside [WSL 2](https://learn.microsoft.com/windows/wsl/install) (Ubuntu), not in PowerShell, Command Prompt or Git Bash. The npm scripts, Husky hooks, the git guardrail and several tests assume a POSIX shell and tools such as `bash` and `unzip`, and CI and Vercel both run Linux. `npm run preflight` fails on native Windows, and `npm install` prints a warning there (#939).

### Automated Interactive Setup

Run the developer onboarding setup wizard:

```bash
npm run setup
```

This automated workflow checks Node/npm versions, syncs `.env.example` to `.env.local` if missing, initializes the Prisma database schema, seeds default clinical trial case study data, and verifies workspace health.

### Secondary Services & Environment Setup

- To configure optional Clerk authentication and author access allowlists interactively:
  ```bash
  npm run setup:clerk
  ```
- To check or auto-synchronize environment variable schema:
  ```bash
  npm run dx env
  npm run dx env -- --fix
  ```

---

## 3. Feature Scaffolding & Vertical Slices

To eliminate manual multi-file creation errors, route drift, and unindexed navigation items, all vertical slices (components, hooks, APIs, ADRs, case studies, arcade games) **must** be created using the Feature Scaffolding CLI.

### Interactive CLI Scaffolding Wizard

Executing the scaffolding command **without positional arguments** launches an interactive terminal wizard:

```bash
npm run scaffold
# or:
npx tsx scripts/dx.ts scaffold
```

The interactive terminal wizard guides you through three steps:

1. **Select Architecture Template Type** (lists all 7 supported architecture template types):
   - `1) component` - Reusable UI component (`components/ui/<Name>.tsx` + companion test)
   - `2) hook` - Custom React hook (`hooks/use<Name>.ts` + companion test)
   - `3) api` - Zod-validated API route (`app/api/<name>/route.ts` + companion test)
   - `4) adr` - Architectural Decision Record (`adr/00XX-<name>.md`)
   - `5) case-study` - Showcase Case Study page (`app/case-studies/<name>/page.tsx` + Command Palette registration + companion test)
   - `6) arcade` - Arcade simulator & engine (`lib/<name>-engine.ts`, `components/<Name>.tsx`, `app/arcade/<name>/page.tsx` + unit tests + Command Palette registration)
   - `7) game` - Interactive game module (arcade alias)

2. **Enter Feature / Asset Name**:
   - Input a descriptive name (e.g. `matrix-defender`, `analytics-card`).
   - The CLI performs input validation to ensure valid non-empty formatting.

3. **Preview Mode / Dry Run Option**:
   - Choose whether to run in preview mode (`--dry-run`).
   - In preview mode, the tool outputs all files and relative paths that would be created or updated without modifying disk state.

### Direct Non-Interactive Scaffolding

For automated CI pipelines, agent scripts, or power users who prefer direct CLI execution, pass explicit positional arguments:

```bash
# Non-interactive command syntax:
npm run scaffold <type> <name> [--dry-run]

# Examples:
npm run scaffold component GlassCard
npm run scaffold hook useTelemetryFilter
npm run scaffold api analytics-stream
npm run scaffold adr event-sourcing-pattern
npm run scaffold case-study quantum-compiler
npm run scaffold arcade cyber-vault
```

Direct positional execution bypasses interactive prompts smoothly, executing non-interactively while applying full input validation.

---

## 4. The 5-Point Discovery Matrix

Whenever a new first-class route, interactive mini-game, or case study page is introduced, it must be indexed across the **5-Point Discovery Matrix**:

1. **Command Palette (`components/CommandPalette.tsx`)**:
   - Registered under `staticNavs` with Tabler icon, title, subtitle, category, and target URL.
   - _Note:_ The CLI scaffolder automatically registers `arcade` games and `case-study` pages into `CommandPalette.tsx` upon scaffolding!
2. **Navbar Navigation (`components/Navbar.tsx`)**:
   - Indexed under desktop dropdown menus (`SYSTEMS_ITEMS` / `ARCADE_ITEMS`) and mobile drawer.
3. **Footer Navigation (`components/Footer.tsx`)**:
   - Categorized under system/arcade links.
4. **Sitemap & SEO Metadata (`app/sitemap.ts` & `lib/seo-metadata.ts`)**:
   - Canonical path and change frequency added to `ROUTE_METADATA_CONFIGS`.
   - Path registered in `CANONICAL_ROUTES` in `lib/dx/page-bench.ts`.
5. **OpenGraph Social Preview (`app/<route>/opengraph-image.tsx`)**:
   - 1200x630 dynamic OpenGraph card generator matching design system (`lib/og-image.tsx`).

---

## 5. Architectural & Quality Invariants

When contributing code, ensure adherence to system invariants detailed in [`AGENTS.md`](./AGENTS.md):

- **No Secondary Navbars**: `app/layout.tsx` renders the sole global `<Navbar />`. Route pages must never render a second `<Navbar />`.
- **Root Header Clearance**: Route pages (`app/**/page.tsx`) must declare top padding clearance (`pt-28`) for the sticky header.
- **Hydration & Storage**: Use `useSyncExternalStore` or safe SSR checks for browser APIs (`typeof window !== "undefined"`).
- **Red-Green Remediation Protocol**: All defect fixes must include isolated reproduction unit tests in `__tests__/` and regression assertions in `__tests__/defect-remediation-regression.test.ts`.
- **WCAG AA Accessibility**: Zero Critical, Serious, or Moderate accessibility violations. Interactive components must support full keyboard navigation and focus trapping.
- **Documentation Synchronization**: Keep `openapi.json` and `docs/` in lockstep. Auto-remediate drift via `npm run doctor:fix`.

---

## 6. Git Conventions & Verification Workflow

### Branch Naming

After the one-time `dev` reconciliation described in
[ADR 0037](./adr/0037-controlled-integration-and-release-deployments.md), all
work branches from `main` and returns through a pull request to `main`. Topic
branches must follow conventional prefixes:

- `feat/*` - New features or components
- `fix/*` - Bug fixes and defect remediations
- `docs/*` - Documentation additions
- `dx/*` - Developer experience and tooling improvements
- `refactor/*` - Code refactoring without behavior changes
- `perf/*` - Performance optimizations
- `chore/*` - Dependencies and repository maintenance
- `test/*` - Test additions without behavior changes
- `jules/*` - Reserved for branches opened by the Jules agent

Open pull requests against `main` and squash-merge them using a Conventional
Commit PR title. During the manual hold, an operator creates a Production
deployment from the merged `main` SHA in the Vercel Dashboard. Keep this hold
until a replacement release policy is approved and verified under
[ADR 0051](./adr/0051-manual-production-releases.md); the nightly-train
proposal is tracked in [#1168](https://github.com/fderuiter/portfolio/issues/1168). Feature branches do not deploy
automatically. See
[Release and deployment workflow](./docs/how-to/release-and-deploy.md).

Generate conforming branch names interactively:

```bash
npm run dx branch
```

### Conventional Commit Messages

Commit messages must adhere strictly to Conventional Commits:
`type(scope): subject` (e.g. `feat(scaffold): add interactive prompt wizard`).

Generate valid commit messages interactively:

```bash
npm run dx commit
```

### Verification & Health Verification

Before pushing changes or opening a Pull Request, run the full verification suite:

```bash
# 1. Run architectural health diagnostics
npm run doctor

# 2. Automatically fix remediable invariant issues (OpenAPI spec, docs drift)
npm run doctor:fix

# 3. Run complete verification gate (type-check, ESLint, docs drift check, benchmarks)
npm run verify

# 4. Execute unit & integration test suite
npm test
```

---

## 7. API Documentation & Drift Verification Workflow

When introducing or modifying public interfaces (`lib/`, `hooks/`, `types/`) or HTTP API routes (`app/api/`), contributors must ensure documentation and specifications remain synchronized to prevent pre-commit blocks and CI build failures:

1. **Compile API Documentation**
   After changing public functions, hooks, or types, manually recompile the TypeDoc reference documentation:

   ```bash
   npm run compile-docs
   ```

2. **Verify Local Documentation Drift**
   Execute the local documentation drift check before committing changes:

   ```bash
   npm run check-docs-drift
   ```

3. **Resolve Drift & Stage Documentation**
   If documentation drift is detected, run `npm run compile-docs` (or `npm run doctor:fix` to auto-remediate) and stage updated markdown files in `docs/` alongside code changes before committing:
   ```bash
   git add docs/ openapi.json
   ```

---

## 8. Local Verification & Continuous Integration (CI) Mapping

To prevent pull request build failures and maintain zero-drift quality standards, local verification commands map directly to automated continuous integration quality gates executed in GitHub Actions workflows (`.github/workflows/ci.yml` and `.github/workflows/synthetic-probes.yml`).

Before submitting a pull request, run the relevant local quality commands or execute the full pre-submission quality gate:

```bash
# Complete pre-submission CI quality gate
npm run quality
```

### CI Quality Gate Mapping

| Local Quality Command                | Continuous Integration Job / Step                                 | Verification Scope & Purpose                                                                          |
| ------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run doctor`                     | `bench-gate` / Verify ADR Invariants & Doctor Health Diagnostics  | Diagnostic audit of architectural and testing invariants (routes, layout, WCAG a11y, hydration)       |
| `npm run doctor:fix`                 | Local Auto-remediation                                            | Auto-remediates fixable architectural invariants and updates OpenAPI & TypeDoc contracts              |
| `npm run env:check`                  | Local environment preflight                                       | Validates `.env.local` schema definitions against `lib/env.ts` and `.env.example`                     |
| `npm run check`                      | `static-gate` / Type Check & Lint                                 | Static TypeScript checking, ESLint, and dependency-boundary enforcement                               |
| `npm run lint:docs`                  | `static-gate` / Lint Documentation                                | Markdown formatting and structure linting via `markdownlint-cli`                                      |
| `npm run check-docs-drift`           | `static-gate` / Check Documentation Drift                         | Verifies lockstep synchronization for TypeDoc API docs, OpenAPI schemas, and onboarding guides        |
| `npm run check:migrations:drift`     | `static-gate` / Check Schema Drift                                | Verifies Prisma database schema against active migrations and checks for drift                        |
| `npm test` / `npm run test:ci`       | `unit-gate` (3 shards) and `unit-coverage` (merged thresholds)    | Comprehensive unit, logic, and state-engine tests with optional coverage                              |
| `npm run test:fuzz`                  | `unit-gate` (part of the Vitest suite)                            | Fast-check property-based testing and generative invariant verification                               |
| `npm run test:mutation`              | `mutation-gate` / Run Stryker Mutation Gate                       | Mutation testing of critical deterministic and security modules                                       |
| `npx playwright test`                | `heavy-gate` (3 chromium shards) and `device-gate`                | Visual regression, interaction, responsive-device, and Playwright-Axe accessibility checks            |
| `npm run analyze:bundle -- --strict` | `build` / Verify Bundle Performance Budgets                       | Enforces JavaScript chunk-size limits and initial shared-bundle gzip budgets                          |
| `npm run bench:pages -- --assert`    | `bench-gate` / Run Real-Browser Sub-Route Web Vitals              | Production-server Core Web Vitals assertions (LCP <= 2500ms, TTFB <= 800ms, CLS <= 0.1)               |
| `npm run audit:security`             | `security-gate` / `Execute Security Audit Gate`                   | Dependency security vulnerability auditing and policy compliance                                      |
| `npm run audit:secrets`              | `security-gate` / Scan Reachable Git History for Secrets          | Redacted scan of all reachable Git history for high-confidence credential patterns                    |
| `npm run audit:triage`               | `scheduled-security-audit.yml` / Triage Security Issue Escalation | Automated GitHub issue escalation for unhandled vulnerabilities and expired overrides                 |
| `npm run probe:synthetic`            | `synthetic-probes.yml` / `Headless Synthetic Probe Matrix`        | Playwright synthetic user probes verifying critical user journeys and API telemetry                   |
| `npm run quality`                    | CI Pipeline Composite Pre-Flight Gate                             | Runs static checks, docs gates, secret-history audit, page benchmarks, and architectural verification |

---

## 9. Asset Generation & Design System Commands

The repository provides standardized CLI commands for generating multi-resolution brand assets and compiling design system tokens:

### Brand Icon Generation

- **Command:** `npm run build:icons` (or `npm run generate:icons` / `npx tsx scripts/dx.ts build:icons`)
- **Input Source Location:** Vector SVG artwork at `public/favicon.svg` (or `app/icon.svg`).
- **Generated Output Asset Targets:**
  - `app/icon.svg` & `public/favicon.svg`: Vector SVG favicons
  - `app/favicon.ico` & `public/favicon.ico`: Multi-resolution Windows ICO container enclosing 16x16, 32x32, and 48x48 PNG buffers
  - `public/apple-touch-icon.png`: 180x180 high-DPI iOS touch icon
  - `public/icon-192.png` & `public/icon-512.png`: Standard PWA web app manifest icons

### Design System Token Compilation

- **Command:** `npm run build:theme` (or `npm run generate:theme` / `npx tsx scripts/dx.ts build:theme`)
- **Input Source Location:** CSS custom properties declared in `app/globals.css` (within the `:root` selector block).
- **Generated Output Asset Target:** `lib/design-manifest.ts` (strongly-typed runtime TypeScript constants exported as `designManifest`).

---

## 10. Database Changes

Schema changes must include a checked-in Prisma migration. See
[DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md) for the development workflow,
production rollout order, and the one-time production baseline procedure.

---

Thank you for contributing to Portfolio Hub!

---

## Licensing of Contributions

The application source is licensed under the [Apache License 2.0](LICENSE). By submitting a pull request you agree that your contribution is licensed under those same terms (inbound = outbound), as described in Apache-2.0 section 5. No separate CLA is required.

Two carve-outs apply and are described in full in [`NOTICE`](NOTICE): the Laser Loon artwork in `public/files/` stays under CC BY 4.0, and editorial content, biography, resume data, photography, and the `Frederick de Ruiter` / `deruiter.dev` marks are all rights reserved. Pull requests that add third-party code must keep its original license intact and record it in `NOTICE`; Apache-2.0-incompatible licenses (GPL, AGPL, SSPL, and non-commercial or source-available licenses) cannot be merged.
