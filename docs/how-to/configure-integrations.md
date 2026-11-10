# How-To: Configure Clerk, Sentry, Upstash, Vercel Cron/Analytics, and GitHub Data Fetching

Goal: set up, verify, and recover each of this project's remaining external
integrations that aren't already covered by a dedicated guide. For Neon/
Prisma and the database itself, see
[tutorial: local development & onboarding](../tutorials/01-local-development-and-onboarding.md)
and [the database migration how-to](write-a-database-migration.md). For Resend and
its deliverability webhook, see
[how-to: configure Resend and webhooks](configure-resend-and-webhooks.md).
See [reference: integration catalog](../reference/integrations-catalog.md)
for the per-environment fact table (credential scope, quotas, missing-service
behavior) this guide doesn't repeat.

Every environment variable named below is declared once in
[`lib/env.ts`](../../lib/env.ts) and mirrored in `.env.example`. After
changing any of them, run:

```bash
npm run env:check
```

This preflight is safe to run with real secrets. It checks that every key
declared in `lib/env.ts` exists in `.env.example` and that your current
environment matches the schema's types. It never opens a network connection to
a provider, never changes one, and never reports a simulated result as a live
success. It can tell you that a credential is present and correctly shaped,
but not that it is *valid*.

The setup wizard saves and offers to publish provider values only after the
provider's offline check succeeds. If required values are missing or a value
fails that check, it leaves the existing file unchanged. Enter the complete
set again on the next run, including any optional values you supplied; the
wizard does not retain rejected input.

## Clerk (admin authentication)

### Setup

```bash
npm run setup:clerk
```

This runs the setup wizard's Clerk adapter (`scripts/setup-clerk-wizard.sh`
delegates to `./scripts/setup.sh --integrations clerk --skip-db`). It walks
through the Clerk dashboard steps and writes `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and the `ADMIN_USER_IDS`/`ADMIN_EMAILS`
allowlist to `.env.local`, reading the secret key with hidden input. To also
publish the keys to a deployment, add `-- --publish vercel --publish-env
preview`; it asks before writing anything. See the
[setup reference](../reference/setup.md#publishing-to-github-or-vercel). See
[ADR 0014](../../adr/0014-clerk-auth-admin-portal.md) for why the admin
surface is gated this way, and
[`lib/auth/admin.ts`](../../lib/auth/admin.ts) for the authorization
contract itself: `ADMIN_USER_IDS` matches on exact Clerk user ID,
`ADMIN_EMAILS` matches only against an email address Clerk reports as
`verification.status === "verified"`. An unverified address on the account
never grants access, even when the string matches.

### Verification

- With no allowlist configured, `/admin` shows the access-denied view to every
  signed-in user. That is the intended default-closed behavior.
- `__tests__/clerk-auth-middleware.test.ts` exercises the full authorization
  contract (verified/unverified/absent verification, denied identity,
  missing allowlist, mismatched identity, and a simulated Clerk provider
  failure) against synthetic Clerk objects. Run it directly when you change
  anything in `lib/auth/admin.ts`:

  ```bash
  npx vitest run __tests__/clerk-auth-middleware.test.ts
  ```

- `proxy.ts` (Next.js 16's replacement for `middleware.ts`: see
  [ADR 0013](../../adr/0013-next16-proxy-migration-and-ssg-telemetry-resilience.md))
  protects `/admin(.*)` and `/api/admin(.*)` via `clerkMiddleware`/
  `createRouteMatcher`; confirm any new admin route falls under one of those
  matchers rather than relying on a page-level check alone.

### Troubleshooting & recovery

- **Every user sees "access denied" including the intended admin**: check
  that `ADMIN_USER_IDS`/`ADMIN_EMAILS` are set in the environment the app is
  actually running in (local `.env.local` vs. the deployed environment's
  variables are separate) and that the matching email is verified in Clerk's
  own dashboard for that user.
- **Locked out of the only configured admin identity**:
  `ADMIN_USER_IDS`/`ADMIN_EMAILS` are plain environment variables, not Clerk
  data. Update the deployment's environment variables in the Vercel project
  settings to recover. Nothing needs to change in Clerk.
- **Clerk backend API unavailable**: `isCurrentUserAdmin()` catches any
  thrown error from `currentUser()`/`auth()` and returns `false`. It fails
  closed, so a Clerk outage denies admin access instead of granting it or
  crashing the request.

## Sentry (error monitoring)

### Setup

Set `NEXT_PUBLIC_SENTRY_DSN` (or leave it unset locally). All three init
points below read that one variable; a DSN only permits sending events, so it
is safe in the browser bundle. Add `SENTRY_ORG`, `SENTRY_PROJECT` and
`SENTRY_AUTH_TOKEN` only if you use Sentry's build-time source-map upload.

There are three separate Sentry init points, matching the three Next.js
runtimes:

- [`sentry.server.config.ts`](../../sentry.server.config.ts), Node.js
  server runtime.
- [`sentry.edge.config.ts`](../../sentry.edge.config.ts), Edge runtime
  (e.g. `proxy.ts`).
- [`instrumentation-client.ts`](../../instrumentation-client.ts) /
  `lib/client-sentry.ts`, browser runtime, initialized lazily on first
  navigation rather than eagerly at module load.

### Verification

- With `NEXT_PUBLIC_SENTRY_DSN` unset, both server configs fall
  back to a dummy DSN (`https://dummy@o0.ingest.sentry.io/0`). Sentry's SDK
  accepts it and drops every event without throwing, so a missing DSN never
  breaks a request. It also means an empty Sentry dashboard proves nothing in
  an environment without a real DSN. Check the deployment's own logs too.
- `sentry.server.config.ts`'s `beforeSend` deliberately discards simulated
  `GameEngineException` errors from the arcade game engines. Keep that filter
  in mind when you check that a *different* error type reaches Sentry.

### Troubleshooting & recovery

- **Real errors not appearing in the Sentry dashboard**: confirm
  `NEXT_PUBLIC_SENTRY_DSN` is set in the deployment's actual
  environment variables (not just locally), and that it isn't still
  pointing at the dummy fallback value.
- **No recovery action needed for a Sentry outage**: every call site uses
  `Sentry.captureException` as a side effect alongside its own
  `console.error` or structured response, so a Sentry outage does not block
  any request path in this codebase.

## Upstash Redis

### Setup

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from an Upstash
Redis database's REST API credentials (Upstash's free tier is REST-only,
which is why this project uses `@upstash/redis` rather than a raw TCP Redis
client; see [`lib/redis.ts`](../../lib/redis.ts)).

To isolate deployments sharing an Upstash database:
- `UPSTASH_REDIS_KEY_PREFIX`: optional custom key prefix (e.g. `preview-pr-123:`).
- In Vercel Previews (`VERCEL_ENV="preview"`), keys get the `preview:` prefix
  automatically, so preview rate limits and telemetry buffers never collide
  with or drain production data.
- Production uses unprefixed keys (`telemetry_buffer`, `telemetry_processing`,
  `@upstash/ratelimit`) so the live queues keep working. Only the operator
  changes the production namespace.

### Verification

Run the Upstash verification CLI, which changes nothing:

```bash
npm run verify:upstash
```

It reports which environments have the variables, which namespace prefix is
active, how close the quota is and, when configured, live connectivity and
latency. It never prints a credential or changes the database. Add `--strict`
in an automated gate to require a live connection, or `--json` for
machine-readable output:

```bash
npm run verify:upstash -- --json
```

You can also exercise the ingestion route locally:

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"eventType": "page_view", "projectSlug": "/dashboard"}'
```

### Outage response & circuit breaker

- **Request deadline**: Rate-limit checks against Upstash have a 1500ms
  deadline. A slower answer trips the circuit breaker, and the request falls
  back to in-memory rate limiting on that instance instead of hanging.
- **Circuit breaker cooldown**: A timeout or connection failure starts a
  30-second cooldown. During it, requests skip Redis and are rate limited by
  an in-memory cache with two generations (`activeGeneration` /
  `inactiveGeneration`), still with the standard `X-RateLimit-*` headers.
- **Recovery probe**: After 30 seconds the breaker is half-open and tries
  Upstash again on the next request. If Upstash answers, shared rate limiting
  resumes.
- **Lossy telemetry buffer fallback**: If a write to the Upstash buffer fails,
  the event is dropped and logged to Sentry, and the API returns HTTP 202
  (`durable: false`) so clients don't retry and make the outage worse.

### Credential rotation & namespace cleanup runbook

- **Credential rotation**: Generate a new REST token in the Upstash console.
  Update the Production URL and token together in Vercel project environment
  variables, then create a Production deployment from the current green `main`
  SHA in the Dashboard (or run the Weekly Train). Vercel binds variables at
  deploy time (ADR 0063). The Upstash REST API has no window where both tokens
  work, so the new deployment is the switch.
- **Preview namespace cleanup**: List preview keys (prefixed `preview:` or
  with a custom PR prefix) with `SCAN 0 MATCH preview:* COUNT 100`. Queue keys
  have a 48-hour TTL (`172800s`) and rate-limit windows expire within 60
  seconds, so nothing needs deleting by hand. Never run an unprefixed
  `FLUSHDB` on a shared instance.
- **Buffered telemetry events never reach Postgres**: check the Vercel Cron
  job (`/api/cron/maintenance`, see below) is firing. Buffered events stay in
  Redis until that route drains them. Ingestion never writes them to Postgres
  directly.

## Vercel Hosting, Cron, Analytics, and Speed Insights

### Setup

- **Hosting**: connect the repository to a Vercel project; `vercel.json` at
  the repository root declares `buildCommand`/`installCommand` and the cron
  schedule below. There is no setup script for this. It is a one-time
  dashboard step, described in Vercel's
  [Git integration docs](https://vercel.com/docs/git). `vercel.json` also sets
  `git.deploymentEnabled: false`, so pushes do not deploy. The weekly release
  train fires a Deploy Hook for Production; Vercel Dashboard → Deployments →
  Create Deployment is the break-glass path
  ([ADR 0063](../../adr/0063-weekly-release-train.md)).
- **Cron**: `vercel.json` schedules `GET /api/cron/maintenance` daily
  (`0 0 * * *`). Vercel signs every cron invocation with an
  `Authorization: Bearer <CRON_SECRET>` header matching the `CRON_SECRET`
  environment variable configured on the project (see
  [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs)). Set
  `CRON_SECRET` in the Vercel project's environment variables to a strong
  random value.
- **Analytics**: `@vercel/analytics/next`'s `<Analytics />` component is
  already mounted in [`app/layout.tsx`](../../app/layout.tsx); Vercel
  Analytics requires no additional environment variable, only that
  Analytics is enabled for the project in the Vercel dashboard.
- **Speed Insights**: `@vercel/speed-insights/next`'s `<SpeedInsights />`
  component is mounted in [`app/layout.tsx`](../../app/layout.tsx); Vercel
  Speed Insights requires no additional environment variable, only that
  Speed Insights is enabled for the project in the Vercel dashboard (free tier).

### Verification

- **Cron**: `lib/security.ts`'s `validateSyncRequest` fails closed (401) in
  any non-development environment when `CRON_SECRET` is unset, and rejects
  any request whose `Authorization` header doesn't match. The fastest local
  check is to call the route with and without the header:

  ```bash
  # Unauthenticated (expected to fail once CRON_SECRET is set and NODE_ENV isn't development)
  curl -i http://localhost:3000/api/cron/maintenance

  # Authenticated
  curl -i http://localhost:3000/api/cron/maintenance \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

- **Analytics**: confirm data appears in the Vercel dashboard's Analytics
  tab after visiting pages on a real (non-local) deployment. Vercel Analytics
  does not report from `next dev`.
- **Speed Insights**: confirm Real Experience Score (RES) and Core Web Vitals
  (LCP, FID/INP, CLS) appear in the Vercel dashboard's Speed Insights tab after
  visiting pages on a deployed preview or production URL. Speed Insights does
  not report from local `next dev`.

### Troubleshooting & recovery

- **Cron job stops running**: check the Vercel dashboard's Cron Jobs tab for
  the job's history and last status. Vercel disables all of a project's cron
  jobs if the project moves to a plan that doesn't support the schedule, so
  confirm the current Hobby-plan cron limits
  at [vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
  before assuming a code regression.
  A missed sync is recoverable without code changes: the buffered events
  remain in Upstash until the next successful sync drains them (bounded by
  Upstash's own retention for the plan in use).
- **`CRON_SECRET` rotated**: update it in the Vercel project's environment
  variables. There is no overlap window, and the new value takes effect only
  after an operator creates a new Production deployment from the current green
  `main` SHA (Vercel Dashboard → Deployments → Create Deployment). No code
  change is required.

## GitHub data fetching

### Setup

`GITHUB_TOKEN` is optional. Without it, [`lib/github.ts`](../../lib/github.ts)
calls GitHub's REST API unauthenticated, which GitHub rate-limits to 60
requests/hour per source IP (see
[GitHub's REST API rate-limit docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).
Setting `GITHUB_TOKEN` to a fine-grained personal access token with public
read-only scope raises this to 5,000 requests/hour. No other permission is
needed, because every call this codebase makes is a read-only fetch from a
public repository.

### Verification

`lib/github.ts` uses Next.js's `unstable_cache`/`fetch` revalidation
(`next: { revalidate: 3600 }`), so a live check means either waiting out the
hour-long cache window or restarting the dev server, then confirming a case
study page's commit-activity graph reflects real GitHub data rather than the
simulated sine-wave fallback (`generateMockCommitActivity`).

### Troubleshooting & recovery

- **Stats look like a smooth sine wave instead of real activity**: that is the
  fallback for a 403 (unauthenticated rate limit) or 404 (private or
  unreleased repository). Set `GITHUB_TOKEN` or wait for the rate-limit window
  to reset.
- **Build fails because of a GitHub API error**: it shouldn't. `lib/github.ts`
  treats 403 and 404 as expected during offline builds and falls back to
  simulated data so a rate limit never fails a static build. A build that
  fails here means the fallback itself has regressed, so fix the fallback
  rather than working around it.
