# ADR 0051: Temporary Manual Production Releases

## Status

Accepted on 2026-09-24; amended on 2026-09-28. This temporarily supersedes
the automatic Production trigger in [ADR 0049](0049-deploy-main-on-green-ci.md)
until a replacement release policy is approved and verified. The hold has
no automatic calendar expiry.

## Context

Recent automated changes caused avoidable release mistakes. The operator is
keeping Production deployment under direct Dashboard control while a
replacement release policy is prepared and verified, with PR review and CI
continuing normally. The Production
Upstash REST credentials also need a verified URL/token pair before another
build can safely run its telemetry and rate limiting paths.

The operator selected a nightly release train, with implementation scheduled
for 2026-10-05 in [issue #1168](https://github.com/fderuiter/deruiter.dev/issues/1168).
The original restoration deadline preceded that implementation. Keep the
manual hold in force across this gap; the scheduled implementation date
does not itself activate a release workflow.

## Decision

- Disable all Vercel Git-triggered deployments during the hold by setting
  `git.deploymentEnabled` to `false` in `vercel.json`. No merge, push, GitHub
  workflow, deploy hook or Vercel CLI command may start a Production release.
- After the PR's Merge Gate is green and merged to `main`, the operator opens
  the `portfolio` project in Vercel, chooses **Deployments → Create
  Deployment**, selects the current `main` commit SHA and Production, then
  presses **Create Deployment**. Deployment Checks must pass before the
  production domains move.
- Keep Production credentials in Vercel. Do not copy them into GitHub or a
  local deploy command. Production builds authenticate Upstash with a REST
  `PING` and require `PONG` before running migrations; failures name the
  variable and never print credential values.
- End the hold only after a replacement ADR is approved, its implementation
  passes the required CI gates, and an operator verifies its release trigger.
  Reconcile the runbooks, agent instructions and guardrail with that decision
  in the same change. Until then, retain `git.deploymentEnabled: false` and
  the Dashboard-only CLI guard. The nightly-train draft remains unactivated.

## Invariant Compliance

- GitHub Actions remains CI-only, and Production secrets remain in Vercel.
- PR checks and the Vercel Deployment Check continue to gate release.
- The temporary hold ends on verified replacement readiness; it does not
  establish manual releases as the long-term policy.
- `npm run quality` and `npm test` are the required repository gates before
  publishing the pull request.

## Consequences

- A merge to `main` no longer creates a Vercel deployment during the hold.
  Production changes only after the operator deliberately creates the
  deployment from the current, green `main` commit in the Dashboard.
- A Production build and its migrations happen only after that manual action.
  A rejected Upstash token stops the build before migrations and leaves the
  current live deployment serving traffic.
- A calendar date cannot silently restore automatic deployments. The operator
  must approve and verify the replacement before this hold ends.
