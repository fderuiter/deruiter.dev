# ADR 0071: On-Demand, Isolated Preview Deployments

## Status

Accepted on 2026-10-27 under
[#1169](https://github.com/fderuiter/deruiter.dev/issues/1169). The owner
chose **on demand, no database** (Tier 0) on the decision card that day.
Tier 1 below is recorded but not set up; turning it on needs the owner's go.
It amends the Preview column of the Environments contract in
[`docs/how-to/release-and-deploy.md`](../docs/how-to/release-and-deploy.md)
and sits beside [ADR 0063](0063-weekly-release-train.md), which it does not
change. It folds in #1024 and #622, both closed into #1169 on 2026-10-20, and
relates to #1047 (protecting the production Neon branch).

## Context

The site has no working preview environment. Three things stop one:

- `vercel.json` sets `git.deploymentEnabled` to `false`, so Git never creates
  a deployment for any branch.
- The project's Ignored Build Step in the Vercel Dashboard cancels every
  non-production build, so a Preview started by hand is cancelled too.
- Until 2026-10-27 the Preview scope shared production values for Neon,
  Resend, Upstash, QStash and Sentry. That morning the owner scoped the shared
  secrets to Production and turned on Vercel's **Separate Production Secret
  Values** setting. Preview now holds only the Clerk keys and `NODE_OPTIONS`.

Production ships once a week through the release train (ADR 0063). Before a
release, CI already replays every migration on a throwaway Postgres
(the `static-gate` job in `ci.yml`) and the train builds the release candidate and
runs the full browser suite against it. Neither lets anyone open one pull
request on real Vercel infrastructure (its CDN, its functions, its image
optimizer, a phone on mobile data) before the PR rides the train.

The constraints are the free tiers (ADR 0036):

- **Vercel Hobby Fluid Active CPU** must stay under 4 hours per rolling 30
  days and was at about 3h20m on 2026-10-27. Builds do not count; function
  invocations on a Preview do.
- **100 deployments per day.** A branch push records a cancelled deployment
  whenever Git deploys are on for that branch, which is how the limit was hit
  on 2026-09-24.
- **Neon Free** allows 3 root branches per project, 10 branches in all and a
  shared storage limit. Production uses one root branch.
- **Upstash** allows 10,000 commands a day and **Resend** 100 emails a day,
  both shared with production if a Preview used the same account.

The site already runs without its services. Every database-backed page has a
static fallback (ADR 0012), `lib/db.ts` refuses to query without a
connection string, rate limiting falls back to memory without Upstash, email
is simulated without Resend, QStash publishes only in production, and the
clinical pages (Study Data, the Clinical Data Platform and CRF Studio) are
built from committed artifacts or run in the browser.

## Decision

### When a Preview exists

- **On demand only.** A Preview is created deliberately for one pull request:
  by the owner from the Vercel Dashboard (Deployments, then **Create
  Deployment**, the PR's branch, environment Preview), or by an agent through
  the Vercel connector when the owner asks for one. Git deploys stay off for
  every branch, so pushes never create a deployment record.
- **The repository owns the build rule.** `vercel.json` sets `ignoreCommand`
  to `node scripts/vercel-ignore-build.js`, which builds production
  deployments and on-demand previews and skips nothing else. The dashboard
  Ignored Build Step is then left empty, so the rule is reviewed and tested
  like any other code.
- **Never promoted.** A Preview is never promoted to Production and never
  given a custom domain. Production comes only from the train's Deploy Hook or
  the break-glass Create Deployment of the current `main` SHA (ADR 0063).

### What a Preview sees

Two tiers. The owner picks which exists.

- **Tier 0, no database (the default).** Preview holds no database, cache,
  email, queue, cron, Sentry or AWS credential. The build substitutes the
  offline connection string, so every database-backed page is generated from
  its fallback content. The blog, case studies, Study Data, the Clinical Data
  Platform and CRF Studio all render. The contact and newsletter forms cannot
  save or send anything, reactions do not persist, and the admin area works only
  against the Clerk development instance.
- **Tier 1, a schema-only preview database (not set up).** One Neon branch
  named `preview`, created as a **schema-only** branch from production. It has
  production's schema and none of its rows, so subscriber and contact data
  cannot leak into it by construction, which a full copy plus a scrub cannot
  promise between the reset and the scrub. It is seeded with the public
  content in `prisma/seed.ts` (case studies and blog posts). Its pooled and
  direct connection strings are the only Preview-scoped `DATABASE_URL` and
  `DATABASE_URL_UNPOOLED`. It uses one of the free plan's three root branches
  and suspends after five minutes idle. Preview builds still never migrate:
  the schema is refreshed by deleting and recreating the branch, which the
  how-to describes. Turning this tier on needs the owner's go, because it
  creates a Neon branch and adds Preview variables.

### Which secrets a Preview gets

- **Allowed in Preview:** `NODE_OPTIONS`; the Clerk development instance's
  `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; and, in Tier 1
  only, the `preview` branch's `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- **Never in Preview:** anything that reaches production data, spends a
  shared quota or reaches real people. That is `CRON_SECRET`, Resend, QStash,
  Upstash and the KV aliases, Sentry's auth token, Vercel Blob,
  `APP_DATABASE_URL`, the `DSQL_*` and `DYNAMODB_*` integration variables, and
  any value naming the production Neon endpoint.
- **Enforced at build time.** `scripts/vercel-preview-preflight.js` runs first
  on every Vercel preview build and fails it when any of the above is present,
  when a Clerk key is a production (`_live_`) key, or when any variable's
  value contains the production Neon endpoint id. It reports names, never
  values. **Separate Production Secret Values** prevents a Preview from
  inheriting a production value; the preflight catches the case the setting
  cannot, a production value pasted into Preview by hand.
- **Sentry stays off in Preview.** Preview errors would spend the 5,000 a
  month production relies on, and the build log and Vercel's runtime log are
  enough for a deployment that lives for an hour.

### How a Preview is torn down

- **Delete it when the PR merges or closes,** from the Dashboard or by asking
  an agent to do it through the connector. A Preview left open keeps its
  functions callable, and every call spends Fluid CPU.
- **Vercel Authentication stays on** for every deployment except custom
  domains (the project's current setting), so only signed-in team members can
  open a Preview and crawlers cannot reach it.
- **Tier 1 only:** the `preview` branch stays between Previews (it costs
  nothing while suspended) and is recreated when a merged migration has
  changed the schema, before the next Preview that needs it.

### How it relates to the release train

Previews and the train never touch each other. A Preview builds a branch
with Preview variables and gets its own `*.vercel.app` URL; the train fires
the Production Deploy Hook for `main`. A Preview build does not read
`WEEKLY_TRAIN`, the hook secret or `release:hold`, does not migrate and does
not change what `/api/version` reports on `deruiter.dev`.

## Alternatives Considered

- **No previews.** Leave the Ignored Build Step as it is and rely on CI. It
  is the cheapest option, but nothing would test the change on Vercel itself
  before release, and the CI browser suite runs on a local production server,
  not the CDN. It stays available: deleting `ignoreCommand` and restoring the
  dashboard rule returns to it.
- **A Preview for every PR (Git deploys on).** Every push would record a
  deployment and build. At about 14 merges a day plus their pushes that
  approaches the 100-a-day limit again, and each open Preview invites traffic
  that spends Fluid CPU.
- **A full copy of production, scrubbed.** Reset-from-parent restores the
  personal data each time and leaves it readable until the scrub runs, with
  the same connection string. The schema-only branch has no such window.
- **Neon's anonymized branches.** Beta, cannot be reset from their parent, and
  each refresh creates a new endpoint, so the Preview variables would change
  every time.
- **Preview migrations behind a flag** (the 2026-09-26 plan's
  `PREVIEW_MIGRATION_ENDPOINT`). CI's migration replay already proves that
  migrations apply, and a migration from an unmerged PR would leave the
  shared `preview` branch ahead of `main`. Recreating the branch is simpler
  and leaves the build with one migration path, production.

## Consequences

- The owner can see a PR on Vercel before it ships, for the cost of one build
  and a few function calls, with no route to production data or services.
- A Tier 0 Preview cannot show content that exists only in the database, such
  as a case study added through the admin area. Tier 1 covers the schema and
  the seeded content, not production's rows.
- A production value pasted into Preview fails the next Preview build. Moving production to a new Neon endpoint means
  updating `PRODUCTION_NEON_ENDPOINT` in the preflight; a test holds it equal
  to the Neon capacity inventory.
- A future service that Preview genuinely needs gets its own free account and
  an amendment here that removes it from the preflight's list.

## Verification

- `npx vitest run __tests__/vercel-preview-preflight.test.ts __tests__/vercel-ignore-build.test.ts __tests__/build.test.ts __tests__/deploy-config.test.ts`
- The first Preview after this lands shows "Preview isolation preflight
  passed." and "Database: none" in its build log, its URL asks for Vercel
  sign-in when opened logged out, and `deruiter.dev/api/version` still
  reports the release commit.
