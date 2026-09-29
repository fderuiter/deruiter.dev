# Release and Deployment Workflow

Last reconciled: 2026-09-28. Manual Production releases remain required under
[ADR 0051](../../adr/0051-manual-production-releases.md) until a replacement
release policy is approved and verified. The nightly-train proposal in
[issue #1168](https://github.com/fderuiter/portfolio/issues/1168) is scheduled
for implementation on 2026-10-05; that date does not activate a release workflow.

**During the manual hold:** open a PR, let CI go green, squash-merge
it, then have an operator create a Production deployment from the current
`main` commit in the Vercel Dashboard.

## The Flow

1. Branch from `main` with an allowed prefix (`feat/`, `fix/`, `chore/`,
   `docs/`, `dx/`, `refactor/`, `perf/`, `test/`), commit with Conventional
   Commits, and open a pull request into `main`.
2. CI (`.github/workflows/ci.yml`) runs on the PR. Merge only when
   **Merge Gate (Required Checks Summary)** is green.
3. Merge after **Merge Gate** is green. Git pushes the merge commit to `main`;
   Vercel does not automatically build it during this temporary hold.
4. In the Vercel Dashboard, open the `portfolio` project and choose
   **Deployments → Create Deployment**. Select the current `main` commit SHA,
   confirm the target is **Production**, and press **Create Deployment**.
5. The Vercel build authenticates Upstash, applies pending migrations through
   the unpooled Neon endpoint, then compiles the site. A failed check or build
   leaves the current deployment serving traffic.
6. Confirm the new deployment's commit SHA, successful build and Deployment
   Check before verifying that `deruiter.dev` points to it.

Everything about production lives in Vercel. GitHub holds no deploy secrets.
Keep Git deployment triggers disabled until the approved replacement is
implemented and verified. The manual hold has no automatic calendar expiry.
[ADR 0049](../../adr/0049-deploy-main-on-green-ci.md) records the superseded
automatic trigger.

## Buttons

| Situation | Do this |
| --- | --- |
| Production is broken after a deploy | Vercel dashboard, Deployments, **Instant Rollback** to the previous production deployment. Then open a `fix/` PR. |
| A Production build failed for a transient reason | Fix the cause, then use **Create Deployment** with the current green `main` SHA. |
| A deployment is built but not live | Its Deployment Check is waiting on CI, or CI failed. Fix forward with a new PR. |

**Redeploy** rebuilds the commit it is pressed on. During this hold, use
**Create Deployment** and select the current `main` SHA to release a merge.
Production deploy commands in the Vercel CLI are blocked by the repository
guardrail during the hold.

## One-Time Setup

In the Vercel dashboard for the `portfolio` project:

1. **Settings, Git:** confirm automatic Git deployments are disabled during
   this hold. `vercel.json` sets `git.deploymentEnabled` to `false` for all
   branches.
2. **Settings, Deployment Checks:** add the GitHub check
   **Merge Gate (Required Checks Summary)** so production waits for CI.
3. **Settings, Environment Variables:** set what
   [Environment Variables](#environment-variables) marks Required for
   Production. The build itself needs only the two Neon URLs, to migrate and
   to prerender real content; the rest are read by the running site.

### Main Branch Protection

Verified through the GitHub API on 2026-09-28 for `fderuiter/portfolio`:

- Pull requests are required, including for administrators. No approving
  reviewer is required for this solo repository.
- The exact required check is **Merge Gate (Required Checks Summary)**,
  bound to the GitHub Actions app (ID `15368`). It summarizes every required
  CI job; a pending or failed summary blocks merging.
- Linear history and conversation resolution are required. Force pushes and
  deletion of `main` are disabled. Squash merging remains the normal path;
  GitHub automatically deletes merged feature branches.
- The up-to-date branch requirement is disabled (`strict: false`) to avoid
  repeating the full browser pipeline after every unrelated `main` merge.
  Resolve conflicts and revalidate when base changes affect the work.

Audit these settings monthly and whenever the CI workflow or Merge Gate name
changes. Use **Settings → Branches → Branch protection rules → main**, or:

```bash
gh api repos/fderuiter/portfolio/branches/main/protection \
  --jq '{checks: .required_status_checks.checks, strict: .required_status_checks.strict, admins: .enforce_admins.enabled, reviews: .required_pull_request_reviews.required_approving_review_count, linear: .required_linear_history.enabled, force: .allow_force_pushes.enabled, deletion: .allow_deletions.enabled, conversations: .required_conversation_resolution.enabled}'
```

Compare the configured check name and app ID with a recent successful PR's
check runs. Do not use `gh pr merge --admin` to bypass pending CI. When using
`gh pr merge --auto --squash`, verify that the PR remains open with auto merge
enabled while Merge Gate is pending, then confirm it merges after success.
Issue [#1247](https://github.com/fderuiter/portfolio/issues/1247) tracks the
pending-CI verification.

## Environments

Three environments, kept apart. This is the intended contract; #1024 tracks
the owner's audit of the live Vercel settings against it.

| | Production | Preview | Development |
| --- | --- | --- | --- |
| **Purpose** | The public site | Checking one PR on real infrastructure before merge | Local work |
| **Created by** | An operator in the Vercel Dashboard after a green `main` merge, during the manual hold | An operator, deliberately, for one PR (below) | `npm run dev` or a local `npm run build` |
| **Domain** | `deruiter.dev`; `www` redirects to the apex (AGENTS.md section 18) | Its own `*.vercel.app` URL only, never a production alias | `localhost` |
| **Access** | Public | Vercel Deployment Protection where the plan provides it; otherwise the URL is unlisted, not private | Local machine |
| **Database** | Production Neon branch; migrations run during the build | A non-production Neon branch (#622); Preview builds never migrate | A local or personal Neon branch |
| **Other services** | Production Upstash, Clerk, Resend and Sentry | Upstash under the `preview:` key prefix; Clerk, Resend and Sentry unset unless a separate non-production value exists | Simulated or unset |
| **Variable scope** | Vercel **Production** scope | Vercel **Preview** scope, with no production credential in it | `.env.local`, never production credentials |

Nothing in this table may be read from production credentials outside the
Production column. The variable-by-variable scopes are in
[Environment Variables](#environment-variables), and the runtime flag
`NODE_OPTIONS=--experimental-require-module` (#995) is set wherever server
rendering runs.

### Using a Preview

Git deployments are off for every branch throughout the manual hold (`vercel.json`),
so a Preview exists only when someone asks for one.

1. **Request:** in the Vercel Dashboard, create a deployment of the PR's
   branch. It builds on Vercel with the Preview variables. The Vercel CLI may
   still create ordinary Preview builds, but never use it for Production.
2. **Verify** before trusting what it shows:
   - Its URL is a `*.vercel.app` deployment URL, and the Domains page shows
     no production alias on it.
   - The Neon endpoint in its `DATABASE_URL` differs from Production's.
     Compare the endpoint names in the dashboard; never copy values out.
   - Its build log shows no migration step. `scripts/build.js` migrates only
     when `VERCEL=1` and `VERCEL_ENV=production`.
3. **Remove** it from the dashboard once the PR is merged or closed, so it
   stops counting against storage.

### Checking a Production Release

A fresh Production deployment of `main` is correct when:

- it was started with **Create Deployment** from the current merged `main`
  commit SHA in the Dashboard, not by Redeploying an older deployment;
- its build log shows "Production configuration preflight passed." and the
  "Upstash REST authentication passed." check before the migration step;
- its Deployment Check passed on **Merge Gate** before the domains moved.

End the hold only after a replacement ADR is approved, its implementation
passes required CI, and an operator verifies its release trigger. Update the
runbooks, agent instructions and guardrail together. Keep
`git.deploymentEnabled: false` until those conditions are met; see ADR 0051
and issue #1168. Vercel does not automatically expire this setting.

## Environment Variables

Every variable declared in `serverEnvSchema` or `clientEnvSchema` in
[`lib/env.ts`](../../lib/env.ts) is listed below, plus the few that only the
build or Vercel reads. `__tests__/deploy-env-matrix.test.ts` fails when this
table and the schema disagree, so add a row in the same PR that adds a
variable.

**What each class means:**

- **Required**: production misbehaves without it. The build fails, cron is
  rejected, or pages return errors.
- **Optional**: the feature it names degrades as described and the rest of the
  site keeps working.
- **Integration**: a Vercel marketplace integration provisions it. Leave it
  in place, but no code in this repository reads it.
- **Platform**: Next.js, Vercel, Node or the test runner sets it. Never set it
  by hand in Vercel.

**What the scope means:** the Vercel environments the variable should be set
in. Preview must never hold a production credential: set a separate,
non-production value there or leave it unset (see #1024). **None** means the
variable is not set in Vercel at all.

**Build versus runtime:** only `DATABASE_URL_UNPOOLED` is needed for the
production build to migrate, and `DATABASE_URL` for it to prerender real
content rather than fail. Everything else is read by the running site.

### Neon and Prisma

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required | Production, Preview | Pooled endpoint for the running app and prerendering. Provisioned by the Neon integration. |
| `DATABASE_URL_UNPOOLED` | Required | Production, Preview | Direct endpoint. `scripts/build.js` migrates through it on production builds and stops the build if it is missing. |
| `DIRECT_URL` | Platform | None | `scripts/build.js` derives it from `DATABASE_URL_UNPOOLED`. Set it locally only. |
| `PGHOST` | Integration | Production, Preview | Neon alias; unused. |
| `PGHOST_UNPOOLED` | Integration | Production, Preview | Neon alias; unused. |
| `PGUSER` | Integration | Production, Preview | Neon alias; unused. |
| `PGDATABASE` | Integration | Production, Preview | Neon alias; unused. |
| `PGPASSWORD` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_URL` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_URL_NON_POOLING` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_USER` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_HOST` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_PASSWORD` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_DATABASE` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_URL_NO_SSL` | Integration | Production, Preview | Neon alias; unused. |
| `POSTGRES_PRISMA_URL` | Integration | Production, Preview | Neon alias; unused. |

### Upstash Redis

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Required | Production, Preview | Without it rate limits are per-instance and in memory, and telemetry is not buffered. |
| `UPSTASH_REDIS_REST_TOKEN` | Required | Production, Preview | Pairs with the URL. |
| `UPSTASH_REDIS_KEY_PREFIX` | Optional | Production | Key namespace. Unset means unprefixed in Production and `preview:` in Preview. Changing it strands any undrained telemetry under the old prefix. |

The Upstash integration also provisions `KV_*` and `REDIS_URL`. No code reads
them.

### Clerk (admin area only)

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional | Production | Needed only for `/admin`. The rest of the site never loads Clerk. |
| `CLERK_SECRET_KEY` | Optional | Production | Needed only for `/admin`. Read by the Clerk SDK. |
| `ADMIN_USER_IDS` | Optional | Production | Admin allowlist. With this and `ADMIN_EMAILS` both empty, admin access is closed. |
| `ADMIN_EMAILS` | Optional | Production | Admin allowlist, by email. |

### Resend

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Optional | Production | Unset means email delivery is simulated and nothing is sent. |
| `RESEND_WEBHOOK_SECRET` | Optional | Production | Unset means every Resend webhook is rejected, so bounces are not recorded. |
| `RESEND_FROM_EMAIL` | Optional | Production | Defaults to `notifications@deruiter.dev`. |
| `CONTACT_NOTIFICATION_EMAIL` | Optional | Production | Recipient for contact-form notifications. Has a default. |

### Sentry

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Production | The only DSN. Server, edge and browser all read it. Unset means events are dropped. |
| `SENTRY_ORG` | Optional | Production | Source-map upload only. |
| `SENTRY_PROJECT` | Optional | Production | Source-map upload only. |
| `SENTRY_AUTH_TOKEN` | Optional | Production | Source-map upload only. Read by the Sentry build plugin, not by `lib/env.ts`. |

### Vercel Blob, cron and GitHub

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Optional | Production | Admin media uploads only. |
| `CRON_SECRET` | Required | Production | `/api/cron/maintenance` returns 401 without it, so the nightly job never runs. |
| `GITHUB_TOKEN` | Optional | None | Raises the GitHub API rate limit. Unset means simulated stats when rate-limited. |

### Canonical URL

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Optional | None | Leave unset in Production: it falls back to `https://deruiter.dev`. If set, it must be exactly that. |

### Build and runtime platform

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `NODE_OPTIONS` | Required | Production | Must contain `--experimental-require-module`, which lets the server load the ESM-only dependency under `isomorphic-dompurify`. Without it server-rendered routes return 500 (#995). |
| `NODE_ENV` | Platform | None | Set by Next.js. |
| `VERCEL` | Platform | None | Set by Vercel on its builds. |
| `VERCEL_ENV` | Platform | None | Set by Vercel. Gates migrations and production-only behaviour. |
| `NEXT_PHASE` | Platform | None | Set by Next.js while prerendering. |
| `NEXT_RUNTIME` | Platform | None | Set by Next.js. |
| `SKIP_DB_HEALTH_CHECK` | Platform | None | Set by `scripts/build.js`. |
| `WS_NO_BUFFER_UTIL` | Platform | None | Set by `lib/env.ts` and `scripts/build.js`. |
| `WS_NO_UTF_8_VALIDATE` | Platform | None | Set by `lib/env.ts` and `scripts/build.js`. |
| `CI` | Platform | None | Set by the CI runner. |
| `GITHUB_ACTIONS` | Platform | None | Set by GitHub Actions. |
| `VITEST` | Platform | None | Set by Vitest. |
| `PLAYWRIGHT_TEST` | Platform | None | Set by the end-to-end harness. |
| `ALLOW_FALLBACK_PRODUCTION_BUILD` | Optional | None | Emergency override that lets a build ship fallback content. Set it for one build only, then remove it. |
| `ALLOW_DESTRUCTIVE_MIGRATIONS` | Optional | None | Emergency override for the migration safety check. Set it for one build only, then remove it. |

### QStash (optional sub-daily email retries)

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `QSTASH_TOKEN` | Optional | Production | Unset means no delayed retry is published and the daily maintenance run is the only retry path. Publishing also requires `VERCEL_ENV=production`. |
| `QSTASH_URL` | Optional | Production | Regional API base URL; the client default is used when unset. |
| `QSTASH_CURRENT_SIGNING_KEY` | Optional | Production | Verifies `/api/webhooks/qstash/retry` deliveries. Unset means the webhook answers 503. |
| `QSTASH_NEXT_SIGNING_KEY` | Optional | Production | Second key so rotation never drops deliveries. Both keys are required. |

A retryable send failure enqueues the email and publishes one delayed message
(5 minutes, then 15 minutes, then 1 hour on later attempts). The webhook
verifies the signature, retries that one queue row and reschedules while it is
still retrying. This adds at most a few messages per failed email, inside the
500 messages per day free tier ([ADR 0036](../../adr/0036-free-tier-offloading-and-provider-quota-governance.md)).
Preview deployments neither publish nor act on deliveries while the QStash
variables stay shared with Production (#622).

### Keeping secrets in Vercel

- Anything prefixed `NEXT_PUBLIC_` is compiled into the JavaScript every visitor
  downloads. Only the Clerk publishable key, the Sentry DSN and the canonical
  URL may carry that prefix. Never give a secret a `NEXT_PUBLIC_` name.
- Mark every other value Sensitive in Vercel and keep it there. Do not copy
  Sensitive values into GitHub secrets, `.env.example`, issues or logs. GitHub
  holds no deploy secrets (ADR 0049).

## Rules That Keep This Safe

- **During the manual hold, migrations start only after the operator creates a
  Production deployment from the current green `main` SHA.** A replacement
  release policy requires approval and verification before it takes effect.
  Every migration must be expand/contract: the live app
  and the new app must both work against the migrated schema. Never drop or
  rename a column in the same PR that stops using it.
- **Hold work back with a flag, not by leaving it unmerged for days.**
- **Database recovery is roll-forward.** Add a new migration through a normal
  PR. Restore from a Neon backup only for confirmed data loss.
- **Git-triggered deployments are paused.** Throughout the manual hold,
  `vercel.json` disables Git deployments for every branch. Preview builds
  never migrate even if an operator starts one by hand.

## Building Production Output Locally

Releasing never needs a local build: during the manual hold, Vercel builds the
selected `main` SHA with the production secrets it holds after an operator
starts **Create Deployment** in the Dashboard (ADR 0051). Build locally only
to inspect what a production build generates, for example to confirm that
database-backed pages render real content (#859).

**What `npm run build` reads.** `scripts/build.js` loads `.env.local` (or
`.env` if there is no `.env.local`) itself, because npm does not. With no
`DATABASE_URL` it substitutes a dummy localhost connection, and every
database-backed page is generated from static fallbacks. That build still
succeeds: the data-source guard (`failBuildOnDataSourceError` in
`lib/build-integrity.ts`) only fails a build when `VERCEL_ENV` is
`production`. Migrations and the configuration preflight run only on Vercel
(`VERCEL=1`), never locally.

**Inputs for a build that proves real content renders:**

1. Put `DATABASE_URL` in `.env.local` (gitignored by `.env*`). Use a database
   you may read, preferably a non-production Neon branch. Copy the string
   from the Neon console, which can show it again without rotating it. Don't
   type it on the command line, where it lands in shell history.
2. Build with the guard on, so an unreachable database fails the build
   instead of falling back silently:

   ```bash
   VERCEL_ENV=production npm run build
   ```

3. Inspect the output, not the logs. The database-backed case studies from
   #870 exist only when the database was read, so
   `.next/server/app/case-studies/equipose.html` and `qrcraftly.html` must be
   present. A fallback-only build has neither (`equipose-randomization.html`
   is a different, static page). The blog cannot tell the two builds apart,
   because missing posts are filled from fallbacks on the success path.

**Two things that do not work:**

- `vercel pull` and `vercel env pull` return the literal `[SENSITIVE]` for
  every Sensitive variable, so a pulled file never contains a usable
  `DATABASE_URL`.
- `vercel env pull` **overwrites** `.env.local` without a backup. Back up a
  working `.env.local` before running any `vercel` command that writes env
  files (#851).

## Production Configuration Preflight

A Vercel production build checks its own configuration before it does
anything else. `scripts/build.js` runs
[`scripts/vercel-production-preflight.js`](../../scripts/vercel-production-preflight.js)
only when `VERCEL=1` and `VERCEL_ENV=production`. Local, CI and preview builds
skip it. It runs before the build substitutes offline dummy values and before
migrations, so a missing variable can't be masked by a fallback or leave a
half-migrated schema.

**Checks that fail the build:**

- **Always required:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `NODE_OPTIONS`.
- **Required once a feature is configured:**
  - Setting `ADMIN_USER_IDS`, `ADMIN_EMAILS` or either Clerk key turns on the
    admin area, which then needs both Clerk keys.
  - Setting any of `SENTRY_ORG`, `SENTRY_PROJECT` or `SENTRY_AUTH_TOKEN` turns
    on source-map upload, which then needs all three.
- **Unsafe values:**
  - A database URL whose protocol isn't `postgres:` or `postgresql:`, or that
    points at localhost.
  - An Upstash URL that isn't `https://`.
  - `NODE_OPTIONS` without `--experimental-require-module`.
  - A Clerk `sk_test_` or `pk_test_` key.
  - A `NEXT_PUBLIC_APP_URL` other than `https://deruiter.dev`. Unset is fine.
  - A value containing a placeholder marker such as `dummy`, `example` or
    `placeholder`.
- **Upstash authentication:** the production build sends one authenticated
  REST `PING` with a three-second timeout and requires `PONG`. A rejected token
  fails the build before migrations; URL, network and service failures name the
  affected variable without printing either credential.

**Optional:** an unset `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
`NEXT_PUBLIC_SENTRY_DSN` or `BLOB_READ_WRITE_TOKEN` prints a note naming the
degraded feature. It doesn't fail the build.

The preflight prints variable names and reasons, never values.

**When it fails:** the build log lists every problem at once, as
`- NAME reason.` The live deployment keeps serving. To fix it:

1. In Vercel, open **Settings, Environment Variables** and correct each named
   variable for **Production**.
2. After confirming the current `main` SHA contains the fix, open **Deployments
   → Create Deployment**, select that SHA, confirm **Production**, and press
   **Create Deployment**. This builds the current code with corrected
   variables. Do not use Redeploy on an older deployment to ship the fix.
3. If the preflight itself is wrong, fix it with a `fix/` PR. It has no
   override variable.

## Capacity

Vercel Hobby limits build hours and Functions storage. The last readings
(2026-09-12) were 87/100 build hours and 9.68/10 GB Functions Storage. Each
operator-created Production release costs one Vercel build during the hold. If a build fails with a quota error,
check Vercel Usage before retrying.
