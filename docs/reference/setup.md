# Reference: Setup Wizard and Agent-Safe Automation Contract

`./scripts/setup.sh` is the one command a fresh clone needs. People get a
guided, staged wizard; agents and CI get the same stages without prompts and
a JSON summary. This page is the exact contract: stages, flags, profiles,
what each stage may change, and how to recover a partial run. Provider
dashboard journeys stay in the guides linked from each integration below.

```bash
git clone https://github.com/fderuiter/deruiter.dev.git
cd deruiter.dev
./scripts/setup.sh
```

`npm run bootstrap` runs the same script. `npm run setup` runs only the
stages after dependencies are installed, for a checkout that already has
`node_modules`.

## Supported platforms and toolchain

| Requirement | Value | Source |
| --- | --- | --- |
| Operating system | Linux, macOS, or Windows through WSL 2 (Ubuntu). Native Windows shells are refused. | `scripts/lib/setup-checks.sh` |
| Shell | bash (macOS's bash 3.2 works) | `scripts/setup.sh` |
| Node.js | `>=22.0.0 <25.0.0` | `package.json` `engines.node` |
| npm | `>=10.0.0`, pinned to `npm@10.9.2` | `package.json` `engines.npm` and `packageManager` |
| git | any recent version | |

The script reads these ranges from `package.json` itself, so this table and
the checks cannot drift apart without `npm run doctor` failing. When a tool is
missing or outside its range, setup prints copyable install commands for
macOS (Homebrew), Debian and Ubuntu (NodeSource), Fedora, Arch, Alpine, WSL
and Windows, plus a version-manager route (`fnm`) that works everywhere. It
never installs a system package itself.

## Stages

| Stage | Run by | What it may change | Skipped by |
| --- | --- | --- | --- |
| `platform` | `scripts/setup.sh` | Nothing | |
| `toolchain` | `scripts/setup.sh` | Nothing | |
| `dependencies` | `scripts/setup.sh` | `node_modules` via `npm ci`; `npm install` only after you confirm, because it can rewrite `package-lock.json` | `--dry-run`; a symlinked `node_modules` is never touched |
| `lockfile` | `npm run setup` | Nothing | |
| `environment` | `npm run setup` | `.env.local` (created from `.env.example`, values upserted) | `--resume` once completed |
| `integrations` | `npm run setup` | `.env.local`; GitHub or Vercel settings only if you choose a destination and confirm | `--skip-integrations` |
| `database` | `npm run setup` | The database at the URL Prisma resolves, only after a separate yes for the schema and for sample data | `--skip-db`, `--skip-db-seed` |
| `verification` | `npm run setup` | Nothing (read-only checks and probes) | runs only what `--verify` asks for, or what you accept |

Each stage reports one status: `completed`, `skipped`, `failed`, `manual`
(a person must finish it, for example a missing secret or a refused
production target) or `cancelled`. Stage outcomes, never values, are saved to
the gitignored `.setup-state.json`.

## Interactive use

Run `./scripts/setup.sh` in a terminal. It asks which profile to use, for any
required values the profile still lacks, which optional integrations to
configure (guided dashboard steps or manual values), whether to apply the
schema and then whether to load sample data, and then offers verification
checks one at a time, cheapest first, stopping at the first no. Ctrl-C
records the current stage as `cancelled`; rerun with `--resume`.

## Non-interactive use (agents and CI)

```bash
./scripts/setup.sh --non-interactive --skip-db --json
./scripts/setup.sh --yes --verify static,env,prisma --json
```

Without a person, setup never prompts, never publishes a credential and
never collects a value. Missing required values become `manual` stages
listed in the summary.

- `--non-interactive` declines every optional step.
- `--yes` accepts each question's safe default. The only defaults that are
  yes are applying the schema to, and seeding, a **local** database. A hosted
  database needs `--apply-schema` and `--seed` explicitly; a production
  target needs `--allow-production-db` and a person.
- Setup also runs without prompts when `CI` is set, stdin is not a terminal,
  or `--json` is given.
- With `--json`, stdout carries exactly one JSON document (the DX envelope,
  with the `SetupResult` under `data`); progress goes to stderr.

Exit codes: `0` done, `1` a stage failed, `2` done with manual steps pending,
`130` cancelled.

## Flags

| Flag | Effect |
| --- | --- |
| `--help` | Print usage. |
| `--profile NAME` | `local-minimal` (default), `hosted-development` or `deployment`. |
| `--yes`, `-y` | No prompts; accept safe defaults. |
| `--non-interactive` | No prompts; decline optional steps. |
| `--dry-run` | Report what would change. Writes no file, runs no install, schema, seed or check. |
| `--resume` | Skip stages `.setup-state.json` records as completed; reuses the recorded profile. |
| `--skip-db` | Skip the database stage (database keys stop being required). |
| `--skip-db-seed` | Skip sample data. |
| `--skip-integrations` | Leave every optional integration in its degraded mode. |
| `--integrations LIST` | Configure these adapters, comma-separated (see below). |
| `--apply-schema` | Apply the schema without asking. |
| `--seed` | Load sample data without asking. |
| `--allow-production-db HOST` | Permit schema and seed on `HOST` despite production markers. A person must still type the host. |
| `--verify [LIST]` | `static`, `env`, `prisma`, `db`, `providers`, `doctor`, `quality`; a bare flag runs all. |
| `--publish github\|vercel` | Offer to publish integration values there; always asks first. |
| `--publish-env ENV` | Vercel environment (`development`, `preview`, `production`) or GitHub Actions environment. |
| `--force-env` | Back up `.env.local` to `.env.local.backup-<timestamp>`, then replace it with the template. |
| `--json` | JSON summary on stdout. |

## Environment profiles

| Profile | Required | Database mutation |
| --- | --- | --- |
| `local-minimal` | `DATABASE_URL`, `CRON_SECRET` | Allowed after confirmation |
| `hosted-development` | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET` | Allowed after confirmation |
| `deployment` | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Never |

`.env.example` is the key inventory, but its example credentials never count
as configuration: a value that matches the template, or contains a marker
such as `example`, `dummy` or `local_secret`, is reported as missing. Setup
generates `CRON_SECRET` with a cryptographically secure generator, derives
`DATABASE_URL_UNPOOLED` from a Neon pooled URL, and points `DIRECT_URL` at
the same database so migrations never fall back to the template's localhost
URL. Every key is classified as secret, public, generated, derived, optional
or runtime-managed (`ENV_KEY_CLASSIFICATION` in
[`lib/dx/setup/environment.ts`](../../lib/dx/setup/environment.ts)).

The environment result reports separately whether the template was created,
whether present values pass the `lib/env.ts` schema, whether every required
value is real, whether optional values are real, and which keys you chose to
skip. A schema failure fails the stage; it is never reported as configured.

## Secrets

- Secret values are read with hidden input and are never printed, logged,
  put in a prompt, written to `.setup-state.json` or included in the JSON
  summary. Summaries list key names only.
- Subprocess output shown by verification is passed through a redactor that
  removes every configured secret value.
- `.env.local` is written atomically (temporary file and rename) with mode
  `0600`. Comments, ordering and unrelated values are preserved; an existing
  real value is replaced only after you confirm, by key name.
- Values reach the GitHub and Vercel CLIs over stdin, never as command-line
  arguments.

## Database sequence

The database stage resolves the URL Prisma will really use, in
`prisma.config.ts` order (`MIGRATION_REPLAY_URL`, `DISPOSABLE_DATABASE_URL`,
`DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_URL`, with the process
environment winning over `.env.local`), and shows only its redacted
`host:port/database` identity.

1. `npx prisma generate` (always safe).
2. Schema, after its own confirmation:
   - a local database (localhost, `127.0.0.1`, `host.docker.internal`, `*.local`)
     gets `npx prisma db push`. A local database is disposable, so syncing the
     schema without writing migration history is the fast, safe path;
   - any hosted database gets `npx prisma migrate deploy`, the committed
     migration workflow production uses, so its history never diverges.
3. `npx prisma db seed`, after a separate confirmation, only once the schema
   applied.

Setup refuses steps 2 and 3 on an obvious production target (the
`deployment` profile, `VERCEL_ENV` or `NODE_ENV` set to production, or a host
or database name containing `prod`, `production`, `live` or `primary`)
unless `--allow-production-db HOST` names that exact host and a person types
it. Detection is a guard, not a proof: a hosted database with a neutral name
is not detected, which is why every hosted mutation also asks first. The
runtime and the seed script connect through `@prisma/adapter-neon`; a plain
PostgreSQL server accepts the schema commands but needs a Neon-compatible
WebSocket proxy before seeding or pages can read it.

## Verification

Checks run cheapest first. Each reports the strongest claim it can make:
`configured` (a value is present), `schema-valid` (it has the right shape),
`live-verified` (a read-only provider call succeeded), `passed` or `failed`
for commands, and `not-checked` for anything nobody asked for. Schema
validation is never reported as live verification.

| Level | Check |
| --- | --- |
| `static` | npm runs and `package-lock.json` exists |
| `env` | Present values match `lib/env.ts` (shape only) |
| `prisma` | `npx prisma validate` |
| `db` | `npx prisma migrate status` (connects; read-only) |
| `providers` | Each configured adapter's shape check, then its read-only probe |
| `doctor` | `npm run doctor` |
| `quality` | `npm run quality` |

## Integrations and degraded modes

Every integration is optional; core setup completes with all of them skipped.

| Adapter | Capability | Portable? | Live probe | If skipped | Guide |
| --- | --- | --- | --- | --- | --- |
| `postgres` | database | Schema commands: any PostgreSQL. Runtime and seed: Neon protocol | none (use `--verify db`) | Pages serve static fallbacks; writes unavailable | [DATABASE_MIGRATIONS.md](../../DATABASE_MIGRATIONS.md) |
| `upstash-redis` | cache | Any Upstash-REST-compatible endpoint | `GET /ping` | In-memory rate limiting; no read-through cache | [Upstash Redis](../how-to/configure-integrations.md#upstash-redis) |
| `upstash-qstash` | queue | Upstash-specific | none | Retries wait for the daily cron | [Integration catalog](integrations-catalog.md) |
| `clerk` | authentication | Clerk-specific | `GET /v1/jwks` | Admin area denies everyone | [Clerk](../how-to/configure-integrations.md#clerk-admin-authentication) |
| `resend` | email | Resend-specific | `GET /domains` (a sending-only key reports `configured`) | Simulated delivery | [Resend](../how-to/configure-resend-and-webhooks.md) |
| `sentry` | monitoring | Any Sentry-protocol service | none (it would send an event) | Errors discarded | [Sentry](../how-to/configure-integrations.md#sentry-error-monitoring) |
| `vercel` | hosting | Cron and Analytics are Vercel features | none | Maintenance cron rejected in deployments | [Vercel](../how-to/configure-integrations.md#vercel-hosting-cron-analytics-and-speed-insights) |
| `github` | source-control API | GitHub-specific | `GET /rate_limit` | Unauthenticated, then simulated stats | [GitHub](../how-to/configure-integrations.md#github-data-fetching) |
| `vercel-blob` | object storage | Vercel-specific | none | Admin media uploads unavailable | [Integration catalog](integrations-catalog.md) |

Each adapter offers a guided path (the dashboard steps) and a manual path
(paste compatible values). `npm run setup:clerk` runs the Clerk adapter on
its own.

## Publishing to GitHub or Vercel

Setup never publishes a value on its own. Publishing happens only when you
pick a destination for an integration, and then only if a person is present,
the destination CLI is already signed in (`gh auth status`, `vercel whoami`),
the Vercel environment is `development`, `preview` or `production`, and you
confirm the exact key names and target. A production target also requires
typing `publish to production`. Secrets go to GitHub Actions secrets,
non-secret values to GitHub Actions variables.

## Rerun, repair and roll back

- **Rerun:** setup is idempotent. Rerunning keeps real values, regenerates
  nothing that is already set, and skips an up-to-date `node_modules`.
- **Resume:** `./scripts/setup.sh --resume` skips completed stages.
- **Repair one step:** every database step in the summary carries its
  `recovery` command, for example `npx prisma migrate deploy`.
- **Start the environment over:** `./scripts/setup.sh --force-env` backs
  `.env.local` up before replacing it. To roll back, copy the backup over
  `.env.local`.
- **Reset progress:** delete `.setup-state.json`.
- **Dependencies:** if `npm install` changed `package-lock.json`, restore it
  with `git checkout -- package-lock.json` and run `npm ci`.
- **Database:** a local `db push` is disposable; drop and recreate the local
  database. Hosted databases follow
  [DATABASE_MIGRATIONS.md](../../DATABASE_MIGRATIONS.md) and
  [restore the production database](../how-to/restore-the-production-database.md).

## Related

- [Onboarding tutorial](../tutorials/01-local-development-and-onboarding.md)
- [Integration catalog](integrations-catalog.md)
- [`lib/dx/setup.ts`](../../lib/dx/setup.ts) and
  [`scripts/setup.sh`](../../scripts/setup.sh)
