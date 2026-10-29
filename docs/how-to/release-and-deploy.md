# Release and Deployment Workflow

Last reconciled: 2026-10-27. Production ships once a week through the weekly
release train in [ADR 0063](../../adr/0063-weekly-release-train.md), accepted on
2026-10-27 after v1.0.0 went live through it. It supersedes the manual
Dashboard releases of [ADR 0051](../../adr/0051-manual-production-releases.md)
(tracked in [issue #1168](https://github.com/fderuiter/deruiter.dev/issues/1168)).

**Day to day:** open a PR, let CI go green and squash-merge it. Merging never
deploys. The next Sunday train releases everything merged since the last
release as one versioned GitHub Release.

## The Flow

1. Branch from `main` with an allowed prefix (`feat/`, `fix/`, `chore/`,
   `docs/`, `dx/`, `refactor/`, `perf/`, `test/`, `dev/`, or `jules/`, which
   is reserved for the Jules agent), commit with Conventional Commits, and
   open a pull request into `main`.
2. CI (`.github/workflows/ci.yml`) runs on the PR. Merge only when
   **Merge Gate (Required Checks Summary)** is green.
3. Merge after **Merge Gate** is green. Git pushes the merge commit to `main`;
   Vercel does not build it, because `vercel.json` disables Git deployments.
4. On Sunday at 7 PM Central the [weekly train](#weekly-train) gates `main`
   HEAD, tests that exact commit, and fires the Vercel Deploy Hook. To ship
   between trains, use **Actions → Weekly Train → Run workflow**, or, as
   break-glass, Vercel **Deployments → Create Deployment** with the current
   `main` commit SHA and target **Production**.
5. The Vercel build authenticates Upstash, type-checks, applies pending
   migrations through the unpooled Neon endpoint, then compiles the site. A
   failed build leaves the current deployment serving traffic. A READY build
   takes the production domains straight away, because the project has no
   Deployment Checks (see [One-Time Setup](#one-time-setup)).
6. Confirm the new deployment's commit SHA and successful build before
   verifying that `deruiter.dev` points to it.

Production credentials live only in Vercel. GitHub holds one
production-adjacent value, the Deploy Hook URL, which can only rebuild `main`.
Git deployment triggers stay disabled: the train is the only automatic path.
[ADR 0049](../../adr/0049-deploy-main-on-green-ci.md) records the earlier
deploy-on-merge trigger.

## Buttons

| Situation | Do this |
| --- | --- |
| Production is broken after a deploy | Vercel dashboard, Deployments, **Instant Rollback** to the previous production deployment. Then open a `fix/` PR. |
| A Production build failed for a transient reason | Fix the cause, then use **Create Deployment** with the current green `main` SHA. |
| A deployment is READY but not live | A Deployment Check was added back in Vercel and is holding the domains. Remove it (see [One-Time Setup](#one-time-setup)); use **Force Promote** only for this one deployment. |

**Redeploy** rebuilds the commit it is pressed on. To release a merge outside
the train, use **Create Deployment** and select the current `main` SHA.
Production deploy commands in the Vercel CLI stay blocked by the repository
guardrail.

## Weekly Train

Run `scripts/setup-operator-wizard.sh release` for interactive, read-only
configuration and release-hold checks. It does not enable the train or verify
the deploy hook; follow the operator steps below to do those.

[ADR 0063](../../adr/0063-weekly-release-train.md) (Accepted) ships Production
through `.github/workflows/weekly-train.yml`. Every Sunday at 7 PM
Central (01:00 UTC Monday), it checks that **Merge Gate (Required Checks
Summary)** passed on `main` HEAD and that no migration since the live commit
is destructive, builds that exact commit and runs the full chromium
Playwright suite on it, drafts a GitHub Release with the next semantic
version, POSTs the Vercel Deploy Hook, waits for `/api/version` to report the
commit, runs the synthetic probes against the live site, and only then
publishes the Release. **Run workflow** with `rc_only` runs just the release
candidate suite on `main` HEAD, and with `dry_run` probes the live site;
neither drafts or deploys anything. The operator set it up in
[#2889](https://github.com/fderuiter/deruiter.dev/issues/2889), and v1.0.0 was
its first release (2026-10-27). The setup, for reference:

1. Vercel, `portfolio`, Settings, Git, **Deploy Hooks**: a hook for `main`.
   It builds Production even with `git.deploymentEnabled` set to `false`
   (#2539).
2. GitHub, Settings, Secrets and variables, Actions: the secret
   `VERCEL_DEPLOY_HOOK_MAIN` holds that URL.
3. No open issue carries `release:hold`.
4. The repository variable `WEEKLY_TRAIN` is `on`; scheduled runs exit
   without it. **Run workflow** works either way.

To pause it, set `WEEKLY_TRAIN` to `off` or open any issue labelled
`release:hold`. A failed release candidate suite ships nothing and opens an
issue without that label. A failed release or smoke test leaves its GitHub Release as
a draft and opens a `release:hold` issue, so the next week skips until a person closes
it. **Create Deployment** and **Instant Rollback** work as before.

To run despite an open hold, an operator starts **Run workflow** on Weekly Train
with `ignore_release_hold` ticked. The run prints the hold number in its summary.
The hold stays open: close it by hand once the release is confirmed on `/api/version`.
Scheduled runs never set this input.

## One-Time Setup

In the Vercel dashboard for the `portfolio` project:

1. **Settings, Git:** confirm automatic Git deployments are disabled.
   `vercel.json` sets `git.deploymentEnabled` to `false` for all branches, so
   only the weekly train's Deploy Hook and the Dashboard start a build.
2. **Settings, Build and Deployment, Deployment Checks:** keep this list
   empty. CI already gates `main`: the ruleset requires
   **Merge Gate (Required Checks Summary)**, and `static-gate` runs lint and
   the type check on every PR and every `main` push. The production build
   type-checks again before it migrates. Vercel's native **Lint** and
   **Typecheck** checks only repeated that work. Typecheck was SIGKILLed for
   memory (exit 137) on every production deploy, because its sandbox runs
   `tsc` and ESLint side by side and they don't fit. Each release then needed
   **Force Promote** (#2899). A GitHub **Merge Gate** check is not a fix
   either: a newer merge cancels the older commit's `main` run, so a deploy of
   that commit would wait on a check that never passes.
3. **Settings, Environment Variables:** set what
   [Environment Variables](#environment-variables) marks Required for
   Production. The build itself needs only the two Neon URLs, to migrate and
   to prerender real content; the rest are read by the running site.

### Main Branch Protection

Since 2026-10-20, `main` is governed by the repository ruleset **`main`**
(ID `25476036`, targeting the default branch). It replaced the classic branch
protection rule, which was deleted, so
`gh api repos/fderuiter/deruiter.dev/branches/main/protection` now returns
`404 Branch not protected`. That is expected.

- Pull requests are required. No approving reviewer is required for this
  solo repository, and review threads must be resolved before merging.
- The only required check is **Merge Gate (Required Checks Summary)**,
  bound to the GitHub Actions app (integration ID `15368`). It summarizes
  every CI job; a pending or failed summary blocks merging. Do not add the
  individual jobs: the matrix jobs report under their literal
  `${{ matrix.shard }}` names when skipped, and the browser gates do not run
  on drafts or docs-only pull requests, so those checks would never report.
- Squash is the only allowed merge method. Linear history is required, and
  force pushes and deletion of `main` are blocked. GitHub automatically
  deletes merged feature branches.
- The up-to-date branch requirement is off
  (`strict_required_status_checks_policy: false`) to avoid repeating the
  full browser pipeline after every unrelated `main` merge. The merge lane
  gives the same guarantee: the slot holder merges `main` in before it goes
  ready.
- The repository admin role may bypass the ruleset only through a pull
  request (`bypass_mode: pull_request`); see
  [Owner Merge Override](#owner-merge-override). Nobody can push to `main`
  directly.

Audit these settings monthly and whenever the CI workflow or Merge Gate name
changes. Use **Settings → Rules → Rulesets → main**, or:

```bash
gh api repos/fderuiter/deruiter.dev/rulesets/25476036 \
  --jq '{enforcement, bypass: .bypass_actors, rules: [.rules[] | {type, parameters}]}'
```

Compare the configured check name and integration ID with a recent
successful PR's check runs. Do not use `gh pr merge --admin` to bypass pending
CI. When using `gh pr merge --auto --squash`, verify that the PR remains open
with auto merge enabled while Merge Gate is pending, then confirm it merges
after success. Issue
[#1247](https://github.com/fderuiter/deruiter.dev/issues/1247) tracks the
pending-CI verification.

### Owner Merge Override

CI runs on GitHub's shared free queue and can be slow. The repository owner
may merge a pull request before Merge Gate finishes, and nobody else can.
The `main` ruleset lists the repository admin role as a bypass actor in
pull-request mode, so on a pull request the owner sees **Merge without
waiting for requirements to be met (bypass rules)**. Everyone else, and
auto-merge, still waits for Merge Gate. The bypass never allows a direct push
to `main`.

Production stays manual, so a bypass merge does not deploy. The cost is that a
bypass merge that breaks `main` turns CI red on every other open pull request
until a fix lands. Use it for changes whose risk is low, and confirm the
`main` run afterward. The override does not relax the rule against
`gh pr merge --admin` from agents: only the owner, in the GitHub UI, uses it.

## Environments

Three environments, kept apart. [ADR 0071](../../adr/0071-on-demand-isolated-previews.md)
decides the Preview column, and `scripts/vercel-preview-preflight.js`
enforces it on every Preview build.

| | Production | Preview | Development |
| --- | --- | --- | --- |
| **Purpose** | The public site | Checking one PR on real infrastructure before merge | Local work |
| **Created by** | The weekly train's Deploy Hook; an operator's **Create Deployment** as break-glass | An operator, deliberately, for one PR (below) | `npm run dev` or a local `npm run build` |
| **Domain** | `deruiter.dev`; `www` redirects to the apex (AGENTS.md section 18) | Its own `*.vercel.app` URL only, never a production alias | `localhost` |
| **Access** | Public | Vercel Authentication (sign-in required) | Local machine |
| **Database** | Production Neon branch; migrations run during the build | None by default (fallback content); optionally the schema-only Neon branch `preview`. Preview builds never migrate | A local or personal Neon branch |
| **Other services** | Production Upstash, Clerk, Resend, QStash, Sentry and AWS | Clerk development instance only; Upstash, Resend, QStash, Sentry, cron and AWS are off | Simulated or unset |
| **Variable scope** | Vercel **Production** scope | Vercel **Preview** scope, with no production credential in it; **Separate Production Secret Values** stays on | `.env.local`, never production credentials |

Nothing in this table may be read from production credentials outside the
Production column. The variable-by-variable scopes are in
[Environment Variables](#environment-variables), and the runtime flag
`NODE_OPTIONS=--experimental-require-module` (#995) is set wherever server
rendering runs.

### Using a Preview

Git deployments are off for every branch (`vercel.json`), so a Preview exists
only when someone asks for one, for one PR. `scripts/vercel-ignore-build.js`
(the project's Ignored Build Step) builds it; the preview preflight checks
its variables first. The steps to create, check and delete one, and what it
can and can't show, are in
[Use a Preview Deployment](use-a-preview-deployment.md).

### Checking a Production Release

A fresh Production deployment of `main` is correct when:

- it was started by the weekly train's Deploy Hook, or by **Create
  Deployment** from the current merged `main` commit SHA, not by Redeploying
  an older deployment;
- `/api/version` reports that commit, and the train published its GitHub
  Release after the smoke test;
- its build log shows "Production configuration preflight passed." and the
  "Upstash REST authentication passed." check before the migration step;
- it took the domains when it became READY, without **Force Promote**.

Keep `git.deploymentEnabled: false`: merges never deploy, and the train is
the only automatic path to Production (ADR 0063). Change the release trigger
only through a new ADR, and update the runbooks, agent instructions and
guardrail together.

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
non-production value there or leave it unset (ADR 0071; the preview
preflight fails a Preview build that holds one). **None** means the
variable is not set in Vercel at all.

**Build versus runtime:** only `DATABASE_URL_UNPOOLED` is needed for the
production build to migrate, and `DATABASE_URL` for it to prerender real
content rather than fail. Everything else is read by the running site.

### Neon and Prisma

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required | Production | Pooled endpoint for the running app and prerendering. Provisioned by the Neon integration. Preview holds one only for the schema-only `preview` branch (ADR 0071). |
| `APP_DATABASE_URL` | Optional | Production | Pooled endpoint as the least-privilege `app_runtime` role; the running app and prerendering prefer it over `DATABASE_URL` ([least-privilege roles](use-least-privilege-database-roles.md)). |
| `DATABASE_URL_UNPOOLED` | Required | Production | Preview holds one only for the `preview` branch (ADR 0071). Direct endpoint. `scripts/build.js` migrates through it on production builds and stops the build if it is missing. |
| `DIRECT_URL` | Platform | None | `scripts/build.js` derives it from `DATABASE_URL_UNPOOLED`. Set it locally only. |
| `PGHOST` | Integration | Production | Neon alias; unused. |
| `PGHOST_UNPOOLED` | Integration | Production | Neon alias; unused. |
| `PGUSER` | Integration | Production | Neon alias; unused. |
| `PGDATABASE` | Integration | Production | Neon alias; unused. |
| `PGPASSWORD` | Integration | Production | Neon alias; unused. |
| `POSTGRES_URL` | Integration | Production | Neon alias; unused. |
| `POSTGRES_URL_NON_POOLING` | Integration | Production | Neon alias; unused. |
| `POSTGRES_USER` | Integration | Production | Neon alias; unused. |
| `POSTGRES_HOST` | Integration | Production | Neon alias; unused. |
| `POSTGRES_PASSWORD` | Integration | Production | Neon alias; unused. |
| `POSTGRES_DATABASE` | Integration | Production | Neon alias; unused. |
| `POSTGRES_URL_NO_SSL` | Integration | Production | Neon alias; unused. |
| `POSTGRES_PRISMA_URL` | Integration | Production | Neon alias; unused. |

### Upstash Redis

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Required | Production | Without it rate limits are per-instance and in memory, and telemetry is not buffered. |
| `UPSTASH_REDIS_REST_TOKEN` | Required | Production | Pairs with the URL. |
| `UPSTASH_REDIS_KEY_PREFIX` | Optional | Production | Key namespace. Unset means unprefixed in Production and `preview:` in Preview. Changing it strands any undrained telemetry under the old prefix. |

The Upstash integration also provisions `KV_*` and `REDIS_URL`. No code reads
them.

### Clerk (admin area only)

| Variable | Class | Vercel scope | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional | Production, Preview | Needed only for `/admin`. The rest of the site never loads Clerk. |
| `CLERK_SECRET_KEY` | Optional | Production, Preview | Needed only for `/admin`. Read by the Clerk SDK. Preview uses the development instance's keys; the preview preflight rejects `_live_` keys. |
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
| `SENTRY_AUTH_TOKEN` | Optional | Production | Source-map upload only, which is off while source maps are disabled ([Build Memory](#build-memory)). Read by the Sentry build plugin, not by `lib/env.ts`. |

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
| `NODE_OPTIONS` | Required | Production, Preview | Must contain `--experimental-require-module`, which lets the server load the ESM-only dependency under `isomorphic-dompurify`. Without it server-rendered routes return 500 (#995). Leave the heap flag out: `scripts/build.js` replaces any `--max-old-space-size` (or `--max_old_space_size`) during builds ([Build Memory](#build-memory)). |
| `NODE_ENV` | Platform | None | Set by Next.js. |
| `VERCEL` | Platform | None | Set by Vercel on its builds. |
| `VERCEL_ENV` | Platform | None | Set by Vercel. Gates migrations and production-only behaviour. |
| `VERCEL_GIT_COMMIT_SHA` | Platform | None | Set by Vercel. `GET /api/version` reports it. |
| `VERCEL_GIT_COMMIT_REF` | Platform | None | Set by Vercel. `GET /api/version` reports it. |
| `NEXT_PHASE` | Platform | None | Set by Next.js while prerendering. |
| `NEXT_RUNTIME` | Platform | None | Set by Next.js. |
| `SKIP_DB_HEALTH_CHECK` | Platform | None | Set by `scripts/build.js`. |
| `WS_NO_BUFFER_UTIL` | Platform | None | Set by `lib/env.ts` and `scripts/build.js`. |
| `WS_NO_UTF_8_VALIDATE` | Platform | None | Set by `lib/env.ts` and `scripts/build.js`. |
| `CI` | Platform | None | Set by the CI runner. |
| `GITHUB_ACTIONS` | Platform | None | Set by GitHub Actions. |
| `VITEST` | Platform | None | Set by Vitest. |
| `PLAYWRIGHT_TEST` | Platform | None | Set by the end-to-end harness. |
| `PLAYWRIGHT_BROWSERS_PATH` | Optional | None | Custom directory path for Playwright browser binaries. |
| `npm_config_user_agent` | Platform | None | Package manager user agent string set by npm/bun/pnpm. |
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
Preview deployments hold no QStash variables (ADR 0071), and the code also
publishes only when `VERCEL_ENV=production`.

### Keeping secrets in Vercel

- Anything prefixed `NEXT_PUBLIC_` is compiled into the JavaScript every visitor
  downloads. Only the Clerk publishable key, the Sentry DSN and the canonical
  URL may carry that prefix. Never give a secret a `NEXT_PUBLIC_` name.
- Mark every other value Sensitive in Vercel and keep it there. Do not copy
  Sensitive values into GitHub secrets, `.env.example`, issues or logs. GitHub
  holds no deploy secrets (ADR 0049).

## Rules That Keep This Safe

- **Migrations run in the Production build the train (or a break-glass
  Create Deployment) starts from a green `main` SHA.** The train holds itself
  when `scripts/check-migration-safety.ts` finds a destructive migration
  since the live commit; that release is then made by hand. Every migration must be expand/contract: the live app
  and the new app must both work against the migrated schema. Never drop or
  rename a column in the same PR that stops using it.
- **Hold work back with a flag, not by leaving it unmerged for days.**
- **Database recovery is roll-forward.** Add a new migration through a normal
  PR. Restore from a Neon backup only for confirmed data loss.
- **Git-triggered deployments stay off.** `vercel.json` disables Git
  deployments for every branch. Preview builds
  never migrate even if an operator starts one by hand, and
  `scripts/vercel-preview-preflight.js` stops a Preview build whose
  variables name the production Neon endpoint or hold a production-only
  credential.

## Building Production Output Locally

Releasing never needs a local build: Vercel builds `main` with the production
secrets it holds when the weekly train fires the Deploy Hook (ADR 0063), or
when an operator starts **Create Deployment** in the Dashboard. Build locally only
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

3. Inspect the output, not the logs. The database-backed case study from
   #870 exists only when the database was read, so
   `.next/server/app/case-studies/qrcraftly.html` must be present. A
   fallback-only build does not have it. (`equipose`, the other database-only
   row, is unpublished and redirected since #1781, so it is no longer built.) The blog cannot tell the two builds apart,
   because missing posts are filled from fallbacks on the success path.

**Two things that do not work:**

- `vercel pull` and `vercel env pull` return the literal `[SENSITIVE]` for
  every Sensitive variable, so a pulled file never contains a usable
  `DATABASE_URL`.
- `vercel env pull` **overwrites** `.env.local` without a backup. Back up a
  working `.env.local` before running any `vercel` command that writes env
  files (#851).

## Build Memory

Vercel builds on a Hobby machine with 2 cores and 8 GB. On 2026-10-28 the
production build outgrew it twice. First the machine ran out of memory
during the webpack compile. After `experimental.webpackMemoryOptimizations`
(#3124), the compile ran out of Node heap at about 3.4 GB instead. CI and
local builds didn't catch either failure, because they ran with more memory
and a 4096 MB heap cap.

Three settings now keep the build inside the machine:

- `scripts/build.js` sets the heap cap itself (`BUILD_HEAP_MB`, 3584 MB). It
  replaces any heap flag in an inherited `NODE_OPTIONS`, spelled with dashes
  or underscores, so Vercel, CI and a laptop compile under the same limit. The build log prints
  the value as `Node heap cap for this build`.
- `next.config.ts` keeps `experimental.webpackMemoryOptimizations` on.
- Sentry source maps are off (`sourcemaps.disable` in `next.config.ts`).
  Generating them took the compile past the cap. Errors still reach Sentry,
  but their stack traces show minified frames.

On Vercel the build skips the TypeDoc reference (`npm run compile-docs`). The
site never serves it, CI's drift check verifies it on the same commit, and it
cost about a minute per deploy.

To build with Vercel's core count (the heap cap comes from `scripts/build.js`),
pin the build to two cores:

```bash
taskset -c 0,1 npm run build
```

Measured on 2 cores on 2026-10-28, the compile at 19ef625 finished with
source maps off and failed with them on. Before raising `BUILD_HEAP_MB`,
measure resident memory as well as heap. The compile's resident memory runs
2 to 3 GB above its heap, so a larger cap can trade a heap failure for the
machine killing the build.

CI's `build` job and the Weekly Train's `rc-build` job run the build through
`scripts/vercel-shaped-build.sh`. It puts the build in a cgroup with 2 CPUs,
8 GB and no swap, the same as Vercel's Hobby machine. The job fails if the
build is killed for memory, or if its peak memory passes 85% of 8 GB. The
step summary reports the peak, so a pull request that adds build memory shows
it before the train deploys it.

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
