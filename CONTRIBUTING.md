# Contributing to Portfolio Hub

Thanks for contributing to Portfolio Hub. This guide covers setup, the architectural rules, how new features are created, and the scaffolding CLI.

---

## 1. Context & Objectives

Portfolio Hub is one site that shows systems engineering, machine learning engines, clinical data tools and arcade games.

The rules for people in this guide are the same rules agents follow in [`AGENTS.md`](./AGENTS.md). Keeping them identical stops routes from drifting, navigation entries from going unindexed, and the architecture from regressing.

### Core Standards

- Node.js `>=22.0.0 <25.0.0` is the only supported runtime.
- npm `>= 10.0.0` is the only supported package manager. `bun`, `yarn` and `pnpm` are not supported.
- A change passes when it has no TypeScript errors, no ESLint warnings, every route indexed and no uncommitted documentation drift.
- New features are created with the scaffolding CLI, which writes the companion tests and registers the feature across the 5-Point Discovery Matrix.

---

## 2. Developer Onboarding & Setup Workflows

### Prerequisites

Setup checks these for you and prints the install command for your platform
when something is missing. You need git, Node.js `>=22.0.0 <25.0.0` (Node 22
or 24 LTS; CI runs Node 24) and npm 10 or newer (`packageManager` pins
`npm@10.9.2`):

```bash
node -v  # Must be >= v22.0.0 and below v25
npm -v   # Must be >= 10.0.0
```

Work on Linux or macOS. On Windows, clone and run the repository inside [WSL 2](https://learn.microsoft.com/windows/wsl/install) (Ubuntu), not in PowerShell, Command Prompt or Git Bash. The npm scripts, Husky hooks, the git guardrail and several tests assume a POSIX shell and tools such as `bash` and `unzip`, and CI and Vercel both run Linux. `npm run preflight` fails on native Windows, and `npm install` prints a warning there (#939).

### Automated Setup

From a fresh clone, run:

```bash
./scripts/setup.sh
```

It checks the toolchain, installs dependencies with `npm ci` and creates `.env.local` for the profile you choose (`local-minimal`, `hosted-development` or `deployment`). It then offers each optional integration, asks before applying the schema and again before loading sample data, and offers verification checks from cheapest to most expensive. It never prints a secret, never publishes a credential without your confirmation, and refuses to change a database that is obviously production. `npm run setup` runs the same stages after dependencies are installed.

Agents and CI run it without prompts:

```bash
./scripts/setup.sh --non-interactive --skip-db --json
```

The [setup reference](docs/reference/setup.md) documents every flag, the profiles, which stages mutate files, databases or deployment settings, and how to resume, repair or roll back a partial run.

### Secondary Services & Environment Setup

- To set up optional Clerk authentication and the author access allowlists (this runs only the setup wizard's Clerk step):
  ```bash
  npm run setup:clerk
  ```
- To check the environment variable schema, or fix it:
  ```bash
  npm run dx env
  npm run dx env -- --fix
  ```

---

## 3. Feature Scaffolding & Vertical Slices

Create every vertical slice (component, hook, API, ADR, case study or arcade game) with the scaffolding CLI. Creating the files by hand is how routes drift and navigation entries go missing.

### Interactive CLI Scaffolding Wizard

Run the scaffolding command with no arguments to start the wizard:

```bash
npm run scaffold
# or:
npx tsx scripts/dx.ts scaffold
```

The wizard asks three questions:

1. **Template type.** It lists the seven types:
   - `1) component` - Reusable UI component (`components/ui/<Name>.tsx` + companion test)
   - `2) hook` - Custom React hook (`hooks/use<Name>.ts` + companion test)
   - `3) api` - Zod-validated API route (`app/api/<name>/route.ts` + companion test)
   - `4) adr` - Architectural Decision Record (`adr/00XX-<name>.md`)
   - `5) case-study` - Case study page (`app/case-studies/<name>/page.tsx` + Command Palette registration + companion test)
   - `6) arcade` - Three-view arcade game ([ADR 0062](./adr/0062-three-views-per-arcade-game.md)): an engine at `lib/<name>/index.ts`; under `components/<name>/` an action map, a session (`use<Name>Session.ts`), a board in `parts/` and `views/{DesktopView,TabletView,PhoneView}.tsx`; a cabinet client using `defineGameViews`; the route and its OpenGraph card; a session unit test and phone and tablet e2e specs. It also adds the game to `ARCADE_REGISTRY`, the arcade metadata, the progress catalog and every discovery registry below. Then run `npm run doctor:fix`, update the tests that list every game (the hub count in `__tests__/arcade-registry.test.ts`, the phone picks in `__tests__/desktop-only-gate.test.tsx`), and once the game has a screenshot at `public/images/arcade/previews/<name>.webp`, add it to `GAME_CARD_COPY` and switch its OpenGraph card to `createGameImageResponse`.
   - `7) game` - Three-view arcade game (arcade alias)

2. **Name.** Enter a descriptive name such as `matrix-defender` or `analytics-card`. The CLI rejects an empty or malformed name.

3. **Dry run.** Choose whether to preview (`--dry-run`). A preview lists every file it would create or update and writes nothing.

### Direct Non-Interactive Scaffolding

Scripts, agents and anyone who would rather skip the prompts can pass the type and name directly:

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

With arguments it runs without prompts and still validates the name.

---

## 4. The 5-Point Discovery Matrix

Every new first-class route, game or case study page is registered in all five places of the **5-Point Discovery Matrix**:

1. **Command Palette (`lib/command-palette/static-navs.ts`)**:
   - An entry in `STATIC_NAVS` with a Tabler icon name, title, subtitle, category and target URL. `components/CommandPalette.tsx` renders the list and maps icon names to icons, so a new icon name also goes in its `STATIC_NAV_ICONS` map.
   - _Note:_ The CLI scaffolder registers `case-study` pages in `lib/command-palette/static-navs.ts`, and `arcade` games in every point of this matrix.
2. **Site Navigation (`lib/navigation.ts`)**:
   - One entry under the right group (Work, Blog, Arcade, Simulators, About, Contact). The top bar, desktop menus, mobile drawer and footer columns all render from this data ([ADR 0058](./adr/0058-site-navigation-information-architecture.md)).
3. **Sitemap & SEO Metadata (`app/sitemap.ts` & `lib/seo-metadata.ts`)**:
   - Canonical path and change frequency added to `ROUTE_METADATA_CONFIGS`.
4. **OpenGraph Social Preview (`app/<route>/opengraph-image.tsx`)**:
   - A 1200x630 OpenGraph card built with the shared design in `lib/og-image.tsx`.
5. **Public Route Registry (`lib/public-routes.ts`)**:
   - Path registered in `PUBLIC_ROUTE_REGISTRY`, which feeds `CANONICAL_ROUTES` in `lib/dx/page-bench.ts` and the service-worker precache.

Arcade games are also registered in `ARCADE_REGISTRY` (`lib/arcade/registry.ts`) with where they are listed and which of their desktop, tablet and phone views are ready ([ADR 0062](./adr/0062-three-views-per-arcade-game.md)). DX Doctor's `routes-arcade-registry-parity` check fails if a registry route is missing from the matrix above.

---

## 5. Architectural & Quality Invariants

The full list of invariants is in [`AGENTS.md`](./AGENTS.md). These are the ones contributors meet most often:

- **One navbar.** `app/layout.tsx` renders the only `<Navbar />`. A route page never renders a second one.
- **Header clearance.** Route pages (`app/**/page.tsx`) declare top padding for the sticky header (`pt-24` to `pt-32`, `min-h-dvh`, or `<PageLayout />`).
- **Hydration and storage.** Read browser APIs through `useSyncExternalStore` or behind an SSR check (`typeof window !== "undefined"`).
- **Red-Green Remediation Protocol.** A bug fix comes with a reproduction test in `__tests__/` and a regression assertion in `__tests__/defect-remediation-regression.test.ts`.
- **WCAG AA accessibility.** No Critical, Serious or Moderate violations. Interactive components work from the keyboard and trap focus where they should.
- **Docs in step with code.** Keep `openapi.json` and `docs/` current. `npm run doctor:fix` repairs the drift it can.

---

## 6. Git Conventions & Verification Workflow

### Branch Naming

After the one-time `dev` reconciliation described in
[ADR 0037](./adr/0037-controlled-integration-and-release-deployments.md), all
work branches from `main` and returns through a pull request to `main`. Topic
branches must follow conventional prefixes:

- `feat/*` - New features or components
- `fix/*` - Bug fixes
- `docs/*` - Documentation additions
- `dx/*` - Developer experience and tooling
- `refactor/*` - Code refactoring without behavior changes
- `perf/*` - Performance work
- `chore/*` - Dependencies and repository maintenance
- `test/*` - Test additions without behavior changes
- `ci/*` - CI workflow and pipeline changes
- `dev/*` - Short-lived personal development branches
- `jules/*` - Reserved for branches opened by the Jules agent

Open pull requests against `main` and squash-merge them using a Conventional
Commit PR title. Merging never deploys: the weekly release train ships
`main` every Monday at 01:00 UTC (Sunday at 7 PM Central standard time,
8 PM daylight time) as a versioned GitHub Release
([ADR 0063](./adr/0063-weekly-release-train.md)). Feature branches do not
deploy automatically. See
[Release and deployment workflow](./docs/how-to/release-and-deploy.md).

Generate conforming branch names interactively:

```bash
npm run dx branch
```

### Conventional Commit Messages

Commit messages follow Conventional Commits:
`type(scope): subject` (e.g. `feat(scaffold): add interactive prompt wizard`).

Generate valid commit messages interactively:

```bash
npm run dx commit
```

### Verification & Health Verification

Before you push or open a pull request, run the full set of checks:

```bash
# 1. Run architectural health diagnostics
npm run doctor

# 2. Automatically fix remediable invariant issues (OpenAPI spec, docs drift)
npm run doctor:fix

# 3. Run the strict DX Doctor invariant gate (docs/OpenAPI drift, routes, layout, a11y, boundaries, benchmark evidence)
npm run verify

# 4. Execute unit & integration test suite
npm test
```

#### Timing budgets

Unit tests never assert on wall-clock time directly. A budget that holds on
an idle runner fails under a parallel build or a mutation run. Pass the
measured time to `expectWithinTimingBudget(label, elapsedMs, budgetMs)` from
`__tests__/helpers/timing-budget.ts` instead. The unit gate records the budget
without enforcing it. To check every budget, run this on an idle machine:

```bash
TIMING_BUDGETS=1 npx vitest run
```

Fake-timer and simulated-clock tests are deterministic. They assert on time
directly.

---

## 7. API Documentation & Drift Verification Workflow

When you add or change a public interface (`lib/`, `hooks/`, `types/`) or an HTTP API route (`app/api/`), update the docs and the API contract with it. Otherwise the pre-commit hook blocks the commit and CI fails:

1. **Check the docs compile**
   Run the drift check before committing. It compiles the TypeDoc reference with warnings as errors, so a broken `{@link}` or doc comment fails here rather than in CI:

   ```bash
   npm run check-docs-drift
   ```

   The compiled reference lands in `docs/reference/api/`, which is git-ignored. Run `npm run compile-docs` to browse it locally; never commit it.

2. **Regenerate and stage the API contract**
   If the check reports an API route missing from `openapi.json`, run `npm run doctor:fix` and stage the contract with your code:

   ```bash
   git add openapi.json
   ```

---

## 8. Local Verification & Continuous Integration (CI) Mapping

Each local command below matches a CI gate in `.github/workflows/ci.yml` or `.github/workflows/synthetic-probes.yml`, so a check that passes locally should pass in CI.

Before you open a pull request, run the commands your change touches, or run all of them at once:

```bash
# Complete pre-submission CI quality gate
npm run quality
```

### CI Quality Gate Mapping

| Local Quality Command                | Continuous Integration Job / Step                                 | Verification Scope & Purpose                                                                           |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run doctor`                     | `bench-gate` / Verify ADR Invariants & Doctor Health Diagnostics  | Diagnostic audit of architectural and testing invariants (routes, layout, WCAG a11y, hydration)        |
| `npm run doctor:fix`                 | Local Auto-remediation                                            | Auto-remediates fixable architectural invariants and updates OpenAPI & TypeDoc contracts               |
| `npm run env:check`                  | Local environment preflight                                       | Validates `.env.local` schema definitions against `lib/env.ts` and `.env.example`                      |
| `npm run check`                      | `static-gate` / Type Check (Memory Budget) & Lint                 | Static TypeScript checking and ESLint (CI covers dependency boundaries through `verify`)               |
| `npm run lint:docs`                  | `static-gate` / Lint Documentation                                | Markdown formatting and structure linting via `markdownlint-cli`                                       |
| `npm run check-docs-drift`           | `static-gate` / Check Documentation Drift                         | Checks that the TypeDoc API docs, OpenAPI schema and onboarding guides are in step                     |
| `npm run check:migrations:drift`     | `static-gate` / Check Schema Drift                                | Verifies Prisma database schema against active migrations and checks for drift                         |
| `npm test` / `npm run test:ci`       | `unit-gate` (3 shards) and `unit-coverage` (merged thresholds)    | Unit, logic and state-engine tests, with optional coverage                                             |
| `npm run test:fuzz`                  | `unit-gate` (part of the Vitest suite)                            | Fast-check property-based testing and generative invariant verification                                |
| `npm run test:mutation`              | `mutation-gate` / Run Stryker Mutation Gate                       | Mutation testing of critical deterministic and security modules                                        |
| `npx playwright test`                | `heavy-gate` (3 chromium shards) and `device-gate`                | Visual regression, interaction, responsive-device, and Playwright-Axe accessibility checks             |
| `npm run analyze:bundle -- --strict` | `build` / Verify Bundle Performance Budgets                       | Enforces JavaScript chunk-size limits and initial shared-bundle gzip budgets                           |
| `npm run bench:pages -- --assert`    | `bench-gate` / Run Real-Browser Sub-Route Web Vitals              | Production-server Core Web Vitals assertions (LCP <= 2500ms, TTFB <= 800ms, CLS <= 0.1)                |
| `npm run audit:security`             | `security-gate` / `Execute Security Audit Gate`                   | Dependency security vulnerability auditing and policy compliance                                       |
| `npm run audit:secrets`              | `security-gate` / Scan Reachable Git History for Secrets          | Redacted scan of all reachable Git history for high-confidence credential patterns                     |
| `npm run audit:triage`               | `scheduled-security-audit.yml` / Triage Security Issue Escalation | Automated GitHub issue escalation for unhandled vulnerabilities and expired overrides                  |
| `npm run probe:synthetic`            | `synthetic-probes.yml` / `Headless Synthetic Probe Matrix`        | Playwright synthetic user probes verifying critical user journeys and API telemetry                    |
| `npm run quality`                    | CI Pipeline Composite Pre-Flight Gate                             | Runs static checks, docs gates, license, secret-history and a11y audits, page benchmarks, and `verify` |

---

## 9. Asset Generation & Design System Commands

Two commands generate the brand icons and the design tokens:

### Brand Icon Generation

- **Command:** `npm run build:icons` (or `npm run generate:icons` / `npx tsx scripts/dx.ts build:icons`)
- **Input Source Location:** Vector SVG artwork at `public/favicon.svg` (or `app/icon.svg`).
- **Generated Output Asset Targets:**
  - `app/icon.svg` & `public/favicon.svg`: Vector SVG favicons
  - `app/favicon.ico` & `public/favicon.ico`: Windows ICO holding 16x16, 32x32 and 48x48 PNGs
  - `public/apple-touch-icon.png`: 180x180 iOS touch icon
  - `public/icon-192.png` & `public/icon-512.png`: PWA manifest icons

### Design System Token Compilation

- **Command:** `npm run build:theme` (or `npm run generate:theme` / `npx tsx scripts/dx.ts build:theme`)
- **Input Source Location:** CSS custom properties declared in `app/globals.css` (within the `:root` selector block).
- **Generated Output Asset Target:** `lib/design-manifest.ts`, typed constants exported as `designManifest`.

---

## 10. Database Changes

Schema changes must include a checked-in Prisma migration. See
[database migrations](docs/how-to/write-a-database-migration.md) for the development workflow,
production rollout order, and the one-time production baseline procedure.

---

## Licensing of Contributions

The application source is licensed under the [Apache License 2.0](LICENSE). By submitting a pull request you agree that your contribution is licensed under those same terms (inbound = outbound), as described in Apache-2.0 section 5. No separate CLA is required.

Two carve-outs apply and are described in full in [`NOTICE`](NOTICE): the Laser Loon artwork in `public/files/` is dedicated to the public domain under CC0 1.0, and editorial content, biography, resume data, photography, and the `Frederick de Ruiter` / `deruiter.dev` marks are all rights reserved. A pull request that adds third-party code keeps that code's license intact and records it in `NOTICE`. A new npm dependency also needs a credits entry and regenerated notices ([how-to](./docs/how-to/manage-dependency-licenses.md)). Code under a license that is incompatible with Apache-2.0 (GPL, AGPL, SSPL, or a non-commercial or source-available license) cannot be merged.
