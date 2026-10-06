# ADR 0049: Deploy Main Through Vercel

## Status

Accepted on 2026-09-24. Temporarily superseded for the manual-release period
by [ADR 0051](0051-manual-production-releases.md) until a replacement release
policy is approved and verified. The nightly-train proposal is tracked in
[issue #1168](https://github.com/fderuiter/deruiter.dev/issues/1168); its scheduled
implementation date does not restore this ADR's trigger. Supersedes
[ADR 0038](0038-protected-build-once-production-releases.md) and, for
production builds only, the migration placement in
[ADR 0001](0001-pre-build-database-migrations.md).

The first version of this ADR, accepted earlier the same day, kept a GitHub
Actions workflow that migrated, built, staged, smoke-tested and promoted each
green `main` commit. Its first real run is recorded under Context; this
version replaces it.

## Context

ADR 0038 made production change only through a manually dispatched GitHub
release that required a new SemVer in `package.json`. By 2026-09-24 it had
never run. Production had served the 2026-09-13 commit for eleven days, and
the only production deploys in that period were dashboard **Redeploy**
actions, which rebuild the commit already live rather than `main`.

The first version of this ADR ran automatically when CI passed on `main`.
Its first run applied migrations and then failed to build, because building
on a GitHub runner depends on `vercel pull`, which cannot download Vercel's
Sensitive environment variables. It wrote the placeholder `[SENSITIVE]` for
31 of them, including every database and cache credential, and
`failBuildOnDataSourceError()` correctly refused to publish. Building outside
Vercel therefore means mirroring every Sensitive value into GitHub and
rotating each secret in two places.

Everything production needs, including the unpooled Neon endpoint the Neon
integration provisions as `DATABASE_URL_UNPOOLED`, already lives in Vercel.

## Decision

Vercel is the only deploy path. GitHub Actions runs CI and nothing that
deploys.

- Outside the temporary manual-release period in ADR 0051, `vercel.json`
  enables Vercel's Git integration for `main` only (`"*": false,
"main": true`). Every other branch still builds nothing.
- `scripts/build.js` runs `prisma migrate deploy` before `next build` when,
  and only when, the build runs on Vercel for the production environment
  (`VERCEL=1` and `VERCEL_ENV=production`). It migrates through
  `DATABASE_URL_UNPOOLED`, because Prisma's advisory lock needs a session
  that the pooled endpoint does not keep. CI, local and preview builds never
  migrate, and a production build without the unpooled endpoint fails.
- Vercel's Deployment Checks hold the production domains until the GitHub
  `Merge Gate (Required Checks Summary)` check passes on the deployed commit.
  This is a project setting in the Vercel dashboard, not repository code.
- The Hobby plan runs one build at a time, so two merges never migrate
  concurrently, and Prisma's migration lock guards the rare overlap.
- Rollback is Vercel's Instant Rollback. The GitHub `production-release`
  environment, its secrets and `.github/workflows/release.yml` are removed.

## Consequences

- One place holds production configuration and secrets. A rotation happens
  once, in Vercel.
- Once ADR 0051 expires, Production tracks `main` within one build of a merge,
  and nobody has to remember to release.
- Migrations run before the build that depends on them. A failed migration
  or build publishes nothing, and a build that cannot reach its data sources
  still fails rather than baking fallback content.
- Migrations apply at build time, before the Deployment Check passes. A
  commit whose CI then fails leaves its migration applied but its code
  unpromoted, so expand/contract discipline is mandatory at review time:
  the live app must keep working against the migrated schema.
- The pre-promotion smoke test against a staged URL is gone. The scheduled
  synthetic probes keep exercising production, and PR CI runs Playwright
  against a production build before merge.
- The build credential can now change the schema. ADR 0001 kept write
  credentials away from compilation, but production builds already held the
  same Neon owner role through `DATABASE_URL` to read content.
- The dashboard **Redeploy** button rebuilds the commit already live, and
  re-running migrations there is a no-op. It is a way to retry a failed
  build, not a way to ship `main`.
