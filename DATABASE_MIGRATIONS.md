# Database migrations

Production schema changes use checked-in Prisma migrations. Do not use
`prisma db push` against production or any long-lived shared environment: it
changes the schema without adding an entry to Prisma's migration history.

## Active migrations

The repository contains seventeen active Prisma migrations:

1. `20260417215437_init`: Initial database baseline and core models.
2. `20260528000000_add_telemetry_event`: Telemetry event ingestion table.
3. `20260814000000_add_simulated_telemetry`: Simulated telemetry flags on case studies.
4. `20260818000000_add_feedback_and_reactions`: Feedback submission and reaction tracking models.
5. `20261014000000_add_commands_and_playback`: Command logging and session playback models.
6. `20261015000000_add_email_resilience`: Suppression list and outbound email retry queue tables.
7. `20261016000000_enforce_email_contracts`: Shared enum contracts on suppression reasons and outbound delivery states with preflight validation and redundant index cleanup.
8. `20261017000000_add_telemetry_daily_rollups`: Additive daily telemetry aggregate table used by the bounded retention phase before raw events older than 30 days are pruned.
9. `20261018000000_add_blog_post`: Adds the `BlogPost` table (ADR 0041) backing the blog's Resilient Hybrid Fallback content service.
10. `20261019000000_add_blog_post_reaction`: Adds the `BlogPostReaction` table and indexes for lightweight, write-buffered reader reaction tracking.
11. `20261020000000_add_case_study_hero_image`: Hero image URL asset reference on case studies.
12. `20261021000000_add_newsletter_subscribers`: Additive newsletter tables (`NewsletterSubscriber`, `NewsletterDispatch`, `NewsletterDelivery`) and a nullable `headers` column on `OutboundEmailQueue` for double opt-in and capped Systems Dispatch delivery (#841).
13. `20261022000000_add_case_study_reaction_unique_constraint`: Deduplicates legacy case study reactions and enforces one reaction per case study, type, and visitor hash (#1114).
14. `20261023000000_add_telemetry_event_created_at_idx`: Adds an index on `TelemetryEvent.createdAt` for timestamp-filtered telemetry queries (#1115).
15. `20261024000000_add_case_study_and_blog_post_composite_indexes`: Adds composite indexes `CaseStudy(published, created_at)` (#1112), `CaseStudyFeedback(caseStudySlug, createdAt)` and `(caseStudySlug, connectionHash, createdAt)` (#1117), and `BlogPost(published, created_at)` and `(published, updated_at)` (#1118).
16. `20261024000000_add_telemetry_event_compound_idx`: Adds a compound index on `TelemetryEvent(eventType, projectSlug)` for accelerated grouping queries.
17. `20261025000000_reorder_blog_post_reaction_unique_constraint`: Reorders unique constraint columns on `BlogPostReaction` to `(blogPostSlug, connectionHash, reactionType)` to enable prefix index matching.

## Normal workflow

1. Change `prisma/schema.prisma` on a disposable development database.
2. Create and review a migration with `npx prisma migrate dev --name <name>`.
3. Run `npm run check:migrations`, replay the full history with
   `npm run migration:replay`, run `npm run check:migrations:drift` against the
   disposable target, and run the test suite.
4. Commit the schema, migration SQL, and `migration_lock.toml` together.
5. Merge through the normal pull-request workflow. Vercel's production build
   of `main` applies committed migrations automatically from `scripts/build.js`
   only when `VERCEL=1` and `VERCEL_ENV=production`.

Production migration credentials are never supplied to local or GitHub Actions
commands. `DATABASE_URL_UNPOOLED` must be provisioned by the Vercel/Neon
integration; the guarded build step maps it to Prisma's `DIRECT_URL` for the
migration process. Preview, CI, and local builds do not apply migrations.

CI checks that the schema provider matches the migration lock, replays every
migration on clean PostgreSQL, and compares the replayed database with
`schema.prisma`. A schema edit without equivalent migration SQL fails that
comparison. The one-time ledger baseline stays manual because it requires a
verified database target and restorable Neon branch or snapshot.

## One-time production baseline for unledgered database setups

For unledgered database setups provisioned prior to migration tracking, the live
database contains schema objects from initial baseline migrations (e.g.
`20260417215437_init` and `20260528000000_add_telemetry_event`) without a
`_prisma_migrations` ledger table.

Rehearse these steps on a restorable Neon branch or snapshot first. Use a
direct, non-pooled connection when Neon provides one. Never run `migrate
reset` or drop the production schema.

### Protect and inspect

1. Create a restorable Neon branch or snapshot.
2. Confirm the database identity without printing the connection string:

   ```sql
   SELECT current_database(), current_schema(), current_user;
   ```

3. Confirm pre-existing table structures match historical baseline files,
   and confirm `_prisma_migrations` is absent.
4. Record checksums before changing the ledger:

   ```bash
   shasum -a 256 prisma/migrations/*/migration.sql
   ```

### Baseline and deploy

With `DATABASE_URL` explicitly set to the rehearsed target, resolve the
pre-applied baseline migrations:

```bash
npx prisma migrate resolve --applied 20260417215437_init
npx prisma migrate resolve --applied 20260528000000_add_telemetry_event
npx prisma migrate status
```

When resolving the initial baseline migrations on an unledgered setup,
`npx prisma migrate status` after `resolve` and before the Vercel production build will report the
remaining active migrations (`20260814000000_add_simulated_telemetry`,
`20260818000000_add_feedback_and_reactions`, and
`20261014000000_add_commands_and_playback`) as pending.

**Halt Condition:** Operators must ONLY halt deployment if `prisma migrate status`
reports missing migration files, unrecognized migrations outside the active inventory,
or unresolvable schema drift errors. Do NOT halt deployment simply because
more than one migration is pending on an unledgered database setup.

### Verify

Verify all of the following before triggering the Vercel deployment:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'CaseStudy'
  AND column_name = 'simulated_telemetry';

SELECT count(*) AS case_studies,
       count(*) FILTER (WHERE simulated_telemetry = false) AS defaulted_false
FROM "CaseStudy";
```

Expected results are all five finished and non-rolled-back migrations recorded in
`_prisma_migrations`:

- `20260417215437_init`
- `20260528000000_add_telemetry_event`
- `20260814000000_add_simulated_telemetry`
- `20260818000000_add_feedback_and_reactions`
- `20261014000000_add_commands_and_playback`

Trigger the Vercel production build after the ledger-only baseline is complete.
The build applies all remaining committed migrations before compilation. After
promotion, confirm `npx prisma migrate status` is clean from a read-only operator
session, then smoke-test the home page, case studies, and telemetry endpoints.

## Release ordering, schema drift & Vercel migration execution

### Schema drift verification

To verify that the database schema is synchronized with `prisma/schema.prisma` without executing live database connections or making mutations, run the schema drift check:

```bash
npm run check:migrations:drift
```

This command runs `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, exiting with code 1 if drift is detected.

To run offline migration safety and integrity checks (provider parity, SQL file integrity, and destructive query scanning):

```bash
npm run check:migrations
```

### Disposable migration replay (`npm run migration:replay`)

To prove that the full committed migration history reaches the current `prisma/schema.prisma` from an empty database without reading ambient production credentials or risking data corruption, run the dedicated migration replay command:

```bash
npm run migration:replay
```

#### Replay execution model & target precedence

1. **Target Precedence**: Replay looks for an explicit disposable target via `--url <url>`, `MIGRATION_REPLAY_URL`, or `DISPOSABLE_DATABASE_URL`. If none is specified, it checks for an available local Docker daemon to spin up an ephemeral container (`postgres:17-alpine`).
2. **Ambient Credential Isolation**: The replay command deliberately ignores `.env`, `.env.local`, and ambient `DIRECT_URL` / `DATABASE_URL` values to prevent accidental replay or drift checks against live environments.
3. **Target Disposability Guard**: External or production hosts (e.g. `*.neon.tech`, `*.supabase.co`, hosts containing `prod`) are strictly refused by default. To explicitly authorize an external or staging rehearsal target, set `ALLOW_NON_DISPOSABLE_TARGET=true` or pass `--allow-non-disposable`. All diagnostics redact user credentials and display safe target information.
4. **Zero-Drift Invariant**: The workflow applies all committed migrations in sequence (`prisma migrate deploy`) and executes a zero-drift schema diff (`prisma migrate diff`) against `prisma/schema.prisma`. Any residual drift or replay error exits with code 1 and actionable diagnostics.

#### Continuous integration replay mode

In CI pipelines or local Docker-less environments, provide an explicit disposable target URL via `MIGRATION_REPLAY_URL` (targeting an ephemeral database such as `portfolio_ci` on `localhost:5432` with a dedicated `replay` schema):

```bash
MIGRATION_REPLAY_URL="${DISPOSABLE_POSTGRES_URL}" npm run migration:replay
```

### Guarded production migration execution

Production migrations run only inside the Vercel production build of `main`.
After offline integrity validation, `scripts/build.js` checks both
`VERCEL === "1"` and `VERCEL_ENV === "production"`, requires
`DATABASE_URL_UNPOOLED` from the Vercel/Neon integration, maps that value to
`DIRECT_URL`, and invokes Prisma's migration deployment before compiling the
application. A missing credential or migration failure stops the build, so the
new deployment is not promoted against an incompatible schema.

There is no supported local, GitHub Actions, or operator-triggered production
migration command. Local and CI workflows are limited to integrity checks,
disposable replay, and drift verification against non-production targets.

### Destructive migration environment variables

Automated migration safety checks (`scripts/check-migrations.js`) block any migration SQL containing destructive operations (`DROP TABLE` or `DROP COLUMN`) by default to prevent accidental data loss.

To explicitly authorize a destructive migration during local integrity
validation:

```bash
ALLOW_DESTRUCTIVE_MIGRATIONS=true npm run check:migrations
```

Every release must follow expand-and-contract:

1. Expand with backward-compatible, additive migration SQL.
2. Validate integrity, replay, and drift locally or in CI without production
   credentials.
3. Merge to `main`; the guarded Vercel production build applies pending
   migrations before compiling and promoting the new deployment.
4. Automated destructive migration guards (`scripts/check-migrations.js`)
   block `DROP TABLE` or `DROP COLUMN` unless `ALLOW_DESTRUCTIVE_MIGRATIONS=true` is explicitly provided.
5. Remove old fields only in a later release after all readers have migrated.

Expand-and-contract remains mandatory because the migration completes before
the new deployment is promoted, while the currently promoted application may
continue serving traffic during the build.

## Email resilience rollout and rollback

`20261015000000_add_email_resilience` is additive and uses `IF NOT EXISTS`
for both tables and all indexes. It is safe to apply to a database where the
email tables were provisioned manually, provided their existing structures
are compatible with `prisma/schema.prisma`.

### Rollout

1. Create a restorable Neon branch or snapshot and confirm the target without
   printing credentials:

   ```sql
   SELECT current_database(), current_schema(), current_user;
   ```

2. Inspect any existing email tables and indexes before deployment:

   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('SuppressionList', 'OutboundEmailQueue');

   SELECT indexname, tablename
   FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename IN ('SuppressionList', 'OutboundEmailQueue')
   ORDER BY tablename, indexname;
   ```

3. Run the offline checks and disposable replay, then merge through the normal
   pull-request workflow. Do not point local commands at production:

   ```bash
   npm run check:migrations
   npm run migration:replay
   ```

4. Verify the migration ledger and required objects before deploying the
   application:

   ```sql
   SELECT migration_name, finished_at, rolled_back_at
   FROM "_prisma_migrations"
   WHERE migration_name = '20261015000000_add_email_resilience';

   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('SuppressionList', 'OutboundEmailQueue');
   ```

5. Let the guarded Vercel production build apply the migration, then run
   `npm run check:migrations:drift` against a non-production verification
   target and require exit code 0. Smoke-test a suppressed recipient and a
   retryable outbound failure after promotion.

### Rollback

This migration has no destructive down migration. If the application release
needs to be reverted, redeploy the previous application version while leaving
these additive tables and indexes in place; older code does not depend on
them. Do not drop either table or manually delete its migration ledger row.

If deployment fails before the migration finishes, stop the release, inspect
`_prisma_migrations`, and restore the rehearsed snapshot only when the target
cannot be safely repaired. After correcting the underlying issue, use
`npx prisma migrate resolve --rolled-back 20261015000000_add_email_resilience`
only for a migration recorded as failed. After repair, retry the failed Vercel
production deployment so `scripts/build.js` remains the sole deployment path.
Never mark a successfully applied migration rolled back.

Prisma serializes concurrent migration attempts with its PostgreSQL advisory
lock. Never automate `migrate resolve`; it is a one-time recovery operation that
requires a verified schema comparison and a restorable snapshot.

## Email contract enforcement (`20261016000000_enforce_email_contracts`)

`20261016000000_enforce_email_contracts` upgrades the string columns on `SuppressionList.reason` and `OutboundEmailQueue.status` into strict PostgreSQL enums (`SuppressionReason` and `OutboundEmailStatus`), drops the redundant non-unique index on `SuppressionList(email)`, and guarantees zero data loss via PostgreSQL `ALTER TABLE ... ALTER COLUMN ... TYPE ... USING` casts.

### Preflight guard

The migration executes an automated preflight check that validates existing rows before attempting type conversion:

- Validates all `SuppressionList.reason` values belong to `'BOUNCE'`, `'COMPLAINT'`, or `'UNSUBSCRIBE'`.
- Validates all `OutboundEmailQueue.status` values belong to `'PENDING'`, `'RETRYING'`, `'DELIVERED'`, or `'FAILED'`.

If any row contains incompatible legacy values, the preflight transaction aborts with a descriptive exception requiring operator remediation rather than silently dropping or corrupting data.

## Connection URLs (`DATABASE_URL` vs `DIRECT_URL`)

Neon databases provide two connection endpoints:

- **Pooled Connection (`DATABASE_URL`)**: Uses Neon's transaction pooler (e.g. `ep-xxx-pooler.us-east-2.aws.neon.tech`). Used by `lib/db.ts` for runtime queries.
- **Production migration connection (`DATABASE_URL_UNPOOLED`)**: The direct Postgres endpoint provisioned by the Vercel/Neon integration. `scripts/build.js` maps it to `DIRECT_URL` only in a Vercel production build.

In Vercel, the Neon integration must provision both `DATABASE_URL` for pooled runtime access and `DATABASE_URL_UNPOOLED` for the guarded production migration. Local development may use `DIRECT_URL` only for disposable development and drift targets; it is not a production deployment mechanism.

## Troubleshooting: Advisory Lock Timeout (`P1002`)

If a build fails with:
`Error: P1002 ... Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369))`

This indicates a dangling lock held by a previous deployment, an interrupted baseline attempt, or a connection pooler holding session state.

### Resolution Steps

1. Connect to the database via Neon SQL Editor or `psql`.
2. Inspect active advisory locks:
   ```sql
   SELECT pid, locktype, mode, granted, classid, objid
   FROM pg_locks
   WHERE locktype = 'advisory';
   ```
3. Terminate the specific backend process holding the advisory lock (advisory locks are session-scoped and can only be unlocked by the owning session or by terminating the backend PID):
   ```sql
   SELECT pg_terminate_backend(l.pid)
   FROM pg_locks l
   WHERE l.locktype = 'advisory'
     AND l.objid = 72707369;
   ```
4. Alternatively, terminate all other active/idle client connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE pid <> pg_backend_pid()
     AND datname = current_database();
   ```
5. Reconnect the Vercel/Neon integration if `DATABASE_URL_UNPOOLED` is absent; do not substitute the pooled URL.
