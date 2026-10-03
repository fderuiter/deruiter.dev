# Tutorial: Local Development & Onboarding

This is a learning-oriented walkthrough for getting a fresh clone of this
repository running locally, with a working database and a passing
verification gate. Follow it top to bottom the first time you set up the
project; once you're up and running, the [how-to guides](../how-to/) cover
specific recurring tasks instead.

## 1. Prerequisites

- **git**, on Linux, macOS, or Windows through WSL 2 (Ubuntu)
- **Node.js `>=22.0.0 <25.0.0`** (Node 22 LTS and Node 24 LTS are both
  supported; CI runs Node 24)
- **npm >= 10.0.0** (the sole supported package manager; bun, yarn, and
  pnpm are unsupported)
- A Postgres connection string (a free [Neon](https://neon.tech) serverless
  Postgres project works well for local development)

You don't need to check these by hand: the setup wizard reads them from
`package.json` and prints the install command for your platform when one is
missing.

## 2. Run the setup wizard

From the repository root:

```bash
./scripts/setup.sh
```

It runs these stages in order and tells you what each one did:

1. **Platform and toolchain**: detects your OS and checks git, Node.js and
   npm against `package.json`.
2. **Dependencies**: `npm ci`, which installs exactly what
   `package-lock.json` records. A `postinstall` hook runs
   `npx prisma generate`, so the Prisma client is ready immediately.
3. **Environment**: pick a profile. `local-minimal` is right for a first
   run. The wizard creates `.env.local` from `.env.example`, generates
   `CRON_SECRET`, and asks (with hidden input) for `DATABASE_URL`.
4. **Integrations**: Clerk, Resend, Upstash, Sentry and the rest are
   optional. Skip them now; each runs in a documented degraded mode.
5. **Database**: asks before applying the schema, then separately before
   loading sample data. It refuses anything that looks like a production
   database.
6. **Verification**: offers checks from cheapest (toolchain) to most
   expensive (`npm run quality`). Say no to stop.

If you stop partway, `./scripts/setup.sh --resume` picks up where you left
off. The [setup reference](../reference/setup.md) documents every flag,
including the non-interactive mode agents and CI use.

## 3. Or configure the environment by hand

The wizard is a convenience over these steps. Copy the example environment
file and fill in your own values:

```bash
npm ci
cp .env.example .env.local
```

At minimum, set `DATABASE_URL` (your Neon/Postgres connection string).
`GITHUB_TOKEN` is optional but avoids GitHub API rate limits when the site
fetches live repository statistics.

Every environment variable this project reads is declared once in
[`lib/env.ts`](../../lib/env.ts) and mirrored in `.env.example`. Validate
your local file against that contract:

```bash
npm run env:check
```

If you need Clerk authentication configured for the admin surfaces, run the
wizard's Clerk adapter on its own instead of hand-editing values:

```bash
npm run setup:clerk
```

## 4. Migrate the database with Prisma

Skip this if the wizard applied the schema for you. Otherwise, push the
committed schema to your local database:

```bash
npx prisma db push
```

Then seed it with the clinical-trial and schema-engine case study content:

```bash
npx prisma db seed
```

Schema changes in this repository always ship as a checked-in Prisma
migration. See
[how-to: add an API route and Zod contract](../how-to/add-api-route-and-zod-contract.md)
for the pattern most new routes follow, and `DATABASE_MIGRATIONS.md` at the
repository root for the full migration workflow, production rollout order,
and the one-time production baseline procedure.

## 5. Run the diagnostic doctor before writing code

Immediately after environment setup and database initialization, confirm
the workspace is healthy:

```bash
# Fast diagnostic pass over the architectural invariants
npm run doctor

# The full invariant verification suite (slower, more thorough)
npm run verify
```

`npm run doctor:fix` will auto-remediate the fixable subset (regenerating
`openapi.json` and TypeDoc markdown, for example) if this reports drift.

## 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js 16 runs with
Turbopack and a concurrent TypeScript watcher, so type errors surface in
the terminal as you edit.

## 7. Run the full test suites

Before committing, run the checks a pre-commit hook and CI will also run:

```bash
npx tsc --noEmit          # type checking
npx eslint --no-warn-ignored .   # lint
npm run lint:boundaries   # deep-module / circular-dependency boundaries
npx vitest run            # unit, logic, and state-engine tests
```

Or run the composite pre-submission gate that CI mirrors exactly:

```bash
npm run quality
```

`npm run quality` runs `check` (typecheck + lint), `lint:docs`,
`check-docs-drift`, `bench:pages -- --assert`, and `verify` in sequence:
the same commands the `rigor-pipeline` GitHub Actions workflow runs against
every pull request.

## Next steps

- Adding a new HTTP endpoint? See
  [how-to: add an API route and Zod contract](../how-to/add-api-route-and-zod-contract.md).
- Wiring up transactional email or webhooks? See
  [how-to: configure Resend and webhooks](../how-to/configure-resend-and-webhooks.md).
- Setting up Clerk, Sentry, Upstash, Vercel Cron/Analytics, or GitHub data
  fetching? See
  [how-to: configure Clerk, Sentry, Upstash, Vercel Cron/Analytics, and GitHub data fetching](../how-to/configure-integrations.md),
  or the full per-environment fact table in the
  [integration catalog](../reference/integrations-catalog.md).
- Looking for the compiled `lib/`, `hooks/`, and `types/` API surface? See
  [reference/api](../reference/api/README.md).
- Curious about *why* the codebase is shaped the way it is? See
  [explanation](../explanation/README.md) and the Architecture Decision
  Records in `adr/` at the repository root.
