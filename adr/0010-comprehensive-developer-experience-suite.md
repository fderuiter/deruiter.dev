# 0010. Comprehensive Developer Experience (DX) Best Practice Tooling Suite

Date: 2026-08-15

## Status

Accepted

## Context

As a multi-paradigm fullstack repository featuring Next.js 16, React 19, Pretext layout calculations, WebGL engines, Prisma ORM, and formal mathematical AST engines, maintaining developer velocity, branch hygiene, environment safety, bundle efficiency, and code cleanliness is paramount.

Without automated, zero-dependency tooling guards:

- Developers face cryptic runtime boot crashes when environment variables are missing or malformed.
- Git histories diverge from Conventional Commits standards, breaking changelog generation and automated release workflows.
- Dead code, unused exports, and unreferenced files accumulate silently over time.
- Bundle sizes inflate unchecked without build-time chunk budget assertions.
- IDE and debugger setups vary across team members, slowing down debugging and local test iteration.

## Decision

We implement a native, zero-dependency Developer Experience (DX) tooling suite orchestrated by `scripts/dx.ts` and `lib/dx/`:

### 1. Runtime Environment Validation & Drift Sentinel (`lib/env.ts`, `lib/dx/env-guard.ts`)

- Declarative Zod schemas separating server-only secrets from client-safe variables (`NEXT_PUBLIC_`).
- Automated `.env.example` synchronization and drift prevention via `npm run doctor:fix` and `npm run dx env`.
- Non-leaking validation diagnostics in `lib/dx/doctor.ts` (`checkEnvironmentVariables`).

### 2. Conventional Commits & Git Hygiene Guard (`lib/dx/git-guard.ts`, `.husky/commit-msg`)

- Strict enforcement of Conventional Commits format (`type(scope): subject`) across allowed types (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `dx`).
- Branch naming convention validation (`feat/*`, `fix/*`, `chore/*`, `refactor/*`, `docs/*`, `perf/*`, `dx/*`, `main`).
- Interactive developer CLI wizard via `npm run dx commit` and `npm run dx branch`.

### 3. Dead Code & Unused Export Scanner (`lib/dx/dead-code.ts`)

- High-speed static AST/regex scanner analyzing exports across `app/`, `components/`, `lib/`, `hooks/`, and `types/`.
- Workspace-wide reference tracking with Next.js App Router and testing framework convention awareness.
- Executable via `npm run dx dead-code` and monitored in `lib/dx/doctor.ts` (`checkDeadCode`).

### 4. Production Bundle Chunk & Performance Budget Guard (`lib/dx/bundle-guard.ts`)

- Build manifest parser evaluating raw and gzip chunk sizes in `.next/static/chunks/`.
- Performance budget assertions (initial shared bundle <= 400 kB gzip, single chunk <= 350 kB gzip), defined by `DEFAULT_BUDGETS` in `lib/dx/bundle-guard.ts`.
- Diagnostic chunk inventory via `npm run dx analyze` and integrated into `lib/dx/doctor.ts` (`checkBundleBudgets`).

### 5. Standardized IDE & Workspace Configuration (`.vscode/*`, `.editorconfig`)

- Universal `.editorconfig` enforcing 2-space indentation, UTF-8, LF line endings, and final newlines.
- `.vscode/settings.json`, `.vscode/extensions.json`, `.vscode/launch.json` (Next.js fullstack, Vitest, Playwright debugging), and `.vscode/tasks.json`.
- Workspace integrity assertion in `lib/dx/doctor.ts` (`checkWorkspaceIdeConfig`).

## Consequences

- Frictionless onboarding: New developers obtain instant environment validation, full IDE debugging capabilities, and automated code generation.
- Pristine git history and automated Conventional Commit authoring.
- Continuous prevention of dead code, environment configuration drift, and production bundle regressions.
