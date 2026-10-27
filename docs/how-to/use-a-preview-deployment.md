# Use a Preview Deployment

Governing decision: [ADR 0071](../../adr/0071-on-demand-isolated-previews.md).
Tracking issue: [#1169](https://github.com/fderuiter/deruiter.dev/issues/1169).

A Preview is a build of one pull request's branch on Vercel, at its own
`*.vercel.app` URL, behind Vercel sign-in. Use one to click through a change
on real Vercel infrastructure (the CDN, functions, image optimization, a real
phone) before it rides the weekly release train. CI has already replayed the
migrations and run the browser suite by then; a Preview is for what CI can't
show you.

Previews exist only when someone asks for one. Git deploys are off for every
branch, so pushing never creates one.

## What a Preview can and can't do

| | Tier 0, no database (default) | Tier 1, preview database |
| --- | --- | --- |
| Pages | Every page builds. Database-backed pages show their fallback content. | Every page builds from the `preview` branch's seeded content. |
| Blog, case studies | Built-in posts and case studies | Seeded posts and case studies |
| Study Data, Clinical Data Platform, CRF Studio | Work fully: built from committed artifacts or run in the browser | Same |
| Contact and newsletter forms | Nothing is saved or sent, and a form may show its error message | Rows go to the `preview` branch; nothing is sent |
| Reactions, page views | Not kept | Kept on the `preview` branch |
| Admin area | Clerk development instance only | Same |
| Email, QStash, cron, Redis, Sentry, AWS | Off | Off |
| Migrations | Never run | Never run |

## Before your first Preview (once)

1. **Clear the dashboard's Ignored Build Step.** Vercel → the `portfolio`
   project → Settings → Git → Ignored Build Step → set it to **Automatic**
   (empty) and save. `vercel.json` now owns this rule through
   `scripts/vercel-ignore-build.js`, which builds production and previews and
   skips everything else. Until the release carrying ADR 0071 is live, the old
   dashboard rule still decides.
2. **Check the Preview scope is clean.** Vercel → Settings → Environment
   Variables, filtered to Preview. It should hold `NODE_OPTIONS` and the two
   Clerk keys, and nothing else unless you set up Tier 1 below. The Clerk keys
   must come from the Clerk **development** instance (`sk_test_…` and
   `pk_test_…`). Keep **Separate Production Secret Values** on.
3. **Keep Deployment Protection on.** Settings → Deployment Protection →
   Vercel Authentication, for all deployments except custom domains. That is
   the current setting; it keeps Previews private and out of search engines.

## Create a Preview

1. Open the PR and note its branch name.
2. Vercel → Deployments → **Create Deployment** → choose the branch → set
   the environment to **Preview** → Deploy. (Or ask an agent to create a
   Preview of PR #N; it uses the Vercel connector and posts the link.)
3. Wait for the build. The log must show, before anything else runs:

   ```text
   --- Phase 0.6: Preview Isolation Preflight (ADR 0071) ---
     Database: none. Database-backed pages use the built-in fallback content.
     ...
   Preview isolation preflight passed.
   ```

   It must not show "Production configuration preflight" or "Applying
   Production Migrations". Those run only for Production.

4. Open the deployment URL (the `portfolio-<hash>-laser-loons-projects.vercel.app`
   one). Vercel asks you to sign in first.

## Check it before you trust it

- The Domains page shows no production alias on the deployment, and
  `https://deruiter.dev/api/version` still reports the release commit.
- `/api/version` on the Preview reports `"env": "preview"` and the PR's
  commit.
- On a phone or a narrow window, walk the pages the PR changed.

## Tear it down

- Delete the deployment when the PR merges or closes: Deployments → the
  Preview → ⋯ → Delete, or ask an agent. Every request to an open Preview
  spends Fluid Active CPU from the same 4 hours a month production uses
  ([ADR 0036](../../adr/0036-free-tier-offloading-and-provider-quota-governance.md)).
- Keep Previews short: open one, check it, delete it. Don't share the URL or
  point monitors at it.

## When the preflight fails

The log names each variable and why:

- **"names the production Neon endpoint"**: a Preview database variable is
  pointed at production. Delete it from the Preview scope. If you're on
  Tier 1, replace it with the `preview` branch's connection string.
- **"is a production-only credential"**: delete that variable from the
  Preview scope. Previews never send email, publish to QStash, use the
  production cache or call AWS.
- **"is a Clerk production key"**: replace the Preview Clerk keys with the
  development instance's keys.

Never work around the preflight. If a Preview genuinely needs a service, it
needs its own free account and an amendment to ADR 0071 first.

## Tier 1: the preview database (not set up)

The owner chose Tier 0 on 2026-10-27, so this tier does not exist yet. Set it
up only after the owner says to. It uses one of the three root
branches Neon's free plan allows.

**Set up:**

1. Neon → project `neon-gray-drum` → Branches → **New branch**. Parent
   `main`, name `preview`, tick **Schema only**, and untick **Automatically
   delete branch after**.
2. Seed public content into it from your own machine, with the `preview`
   branch's direct connection string in `.env.local` as `DATABASE_URL` (never
   the production one):

   ```bash
   npm run seed
   ```

   The seed writes only case studies and blog posts.

3. Vercel → Environment Variables → add `DATABASE_URL` (the pooled string)
   and `DATABASE_URL_UNPOOLED` (the direct string), each scoped to **Preview
   only** and marked Sensitive.
4. Create a Preview and check the build log says "Database: a non-production
   Neon endpoint."

**Refresh the schema** after a merged migration, before the next Preview that
needs it. Preview builds never migrate, so delete the `preview` branch,
recreate it as above, re-seed, and update the two Preview variables with the
new connection strings. A schema-only branch can't be reset from its parent.

**Turn it off** by deleting the two Preview variables and the `preview`
branch. Previews go back to Tier 0.

## Related

- [Release and deploy](release-and-deploy.md): environments, variables and
  the weekly train.
- [Monitor Vercel headroom](monitor-vercel-headroom.md): Fluid CPU and the
  deployment limit.
