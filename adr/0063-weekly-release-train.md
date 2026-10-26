# ADR 0063: Weekly Release Train

## Status

Proposed on 2026-10-26, under
[#1168](https://github.com/fderuiter/deruiter.dev/issues/1168) and the owner
checklist [#2889](https://github.com/fderuiter/deruiter.dev/issues/2889). The
operator asked for weekly automatic production releases with automatic
versioning on 2026-10-26 and chose Sunday 7 PM Central. This ADR amends the
trigger in [ADR 0049](0049-deploy-main-on-green-ci.md). It replaces
[ADR 0051](0051-manual-production-releases.md) only once accepted, after the
operator's first manual run proves the Deploy Hook builds Production; until
then ADR 0051's manual hold stands. It replaces the nightly cadence in the
2026-10-19 release pipeline design.

## Context

Production ships only when the operator presses **Create Deployment** in the
Vercel Dashboard. About 14 commits reach `main` a day, the operator released
five times between 2026-10-04 and 2026-10-19, and the last version tag is
v0.4.1 from 2026-09-30. Nothing records which version is live beyond the
commit SHA that `/api/version` reports, and `CHANGELOG.md` stopped at
"Unreleased".

The operator wants merges never to deploy, and one release a week that is
versioned, tagged, described and shipped without a person. Vercel's native
Deployment Checks were removed on 2026-10-26 (#2899), so a READY production
build takes the domains straight away: the release gate has to run before
the build starts.

## Decision

- `.github/workflows/weekly-train.yml` runs every Monday at 01:00 UTC (Sunday
  7 PM Central Standard Time, 8 PM during daylight saving time) and on
  **Run workflow**. It never builds, migrates, or holds a Vercel token.
- **Gates, in order.** Scheduled runs exit unless the repository variable
  `WEEKLY_TRAIN` is `on`. Every run exits while an open issue carries the
  `release:hold` label. The candidate is `main` HEAD; the run exits when the
  live site already serves it, unless `force` is set. **Merge Gate (Required
  Checks Summary)** must have passed on the candidate (the run waits up to 45
  minutes and follows HEAD if a newer merge lands). `scripts/check-migration-safety.ts`
  must find no destructive migration between the live commit and the
  candidate; a finding opens a `release:hold` issue for a manual release.
- **Versioning.** Semantic Versioning from the Conventional Commits since the
  last `v*` tag: a `feat` bumps the minor version, otherwise the patch; a
  breaking change bumps the major version, or the minor version before 1.0.0.
  A manual run may set the version, for example 1.0.0. The release notes
  group the commit subjects into Features, Fixes, Performance and Other
  changes, with a compare link. GitHub Releases are the changelog from here
  on; `CHANGELOG.md` points to them.
- **Ship exactly the release commit.** The run drafts the GitHub Release
  against the candidate, re-checks that `main` HEAD still equals it, then
  POSTs the Vercel Deploy Hook stored in the secret `VERCEL_DEPLOY_HOOK_MAIN`.
  The hook builds `main` and can do nothing else.
- **Confirm, then publish.** The run waits up to 40 minutes for
  `/api/version` to report the candidate, then publishes the Release, which
  creates the tag. Otherwise the Release stays a draft and the run opens a
  `release:hold` issue assigned to the operator, which pauses the next week.
- `vercel.json` keeps `git.deploymentEnabled: false`, so merges and branch
  pushes never build. **Create Deployment** stays the break-glass path and
  **Instant Rollback** stays the rollback.

## Invariant Compliance

- GitHub holds one production-adjacent value, the hook URL, which can only
  rebuild `main`. Production credentials stay in Vercel.
- The workflow asks for `contents: write` (tags and Releases), `checks: read`
  and `issues: write`, uses no `environment:`, and runs on a standard runner
  with `timeout-minutes`.
- `__tests__/deploy-config.test.ts` pins the triggers, permissions, gates and
  the absence of any build, migration or Vercel CLI call.

## Consequences

- One deployment record a week, far inside Vercel Hobby's 100 a day; a
  release adds build minutes, not Fluid Compute.
- Each week ships as one numbered, described batch, so a regression maps to a
  Release and its compare link.
- The Deploy Hook builds `main` HEAD when it fires. A merge in the seconds
  between the re-check and Vercel's fetch would ship an untagged commit; the
  confirm stage sees the mismatch, leaves the Release a draft and holds the
  train. If that ever happens, move the trigger to a `production` branch that
  the train fast-forwards to the tag.
- Whether a Deploy Hook builds while `git.deploymentEnabled` is `false` is
  not documented. The operator's first manual run settles it; if it does not
  build, this ADR is amended to the `production` branch before acceptance.
- `main` push CI skips the browser suite, which every PR ran before merge.
  Running it on the release commit (#2536) and smoke-testing the live site
  after the release (#2538) are the next steps.

## Acceptance

Accept this ADR after the operator has created the hook and secret, lifted
the hold, and seen one manual run go live. Acceptance supersedes ADR 0051
and reconciles AGENTS.md, DEPLOYMENT.md, the runbook and
`scripts/git-guardrail.sh` in the same change.
