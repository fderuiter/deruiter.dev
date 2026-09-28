# ADR 0050: One-Time Jules Consolidation Release

## Status

Accepted on 2026-09-24 as a temporary exception to ADR 0037. This ADR governs
the current `dev` → `main` release only; it does not establish `dev` as a
permanent integration or staging branch. After this consolidation, normal
feature pull requests target `main` under ADR 0037. Production deployment
follows the temporary manual-release hold in ADR 0051 until a replacement
release policy is approved and verified.

## Context

Google Jules produced many feature and fix pull requests. The work was
consolidated on the shared `dev` branch so that the changes could be reviewed
and preserved together instead of discarded. `main` also received updates
during that process. At the audit snapshot, `origin/main` was already an
ancestor of `origin/dev`, so the main-to-dev synchronization had no commit or
conflict to apply. The existing pull request #1029 proposes the consolidated
tree from `dev` to `main`.

The current local and remote `dev` branch exists to finish this recovery. It is
not a reason to keep two permanent integration branches or to route future
feature work through another staging queue. Vercel previews are unavailable
for the current outage window, so local checks provide pre-merge evidence;
GitHub Actions can validate the eventual PR once available. No Vercel preview
deployment is part of this decision.

## Decision

- Complete the current consolidation through the reviewed `dev` → `main` PR.
  Do not merge it until the local quality gates pass and any unavailable
  external checks are explicitly recorded.
- Preserve shared `dev` history. Merge any `main` commits needed during this
  release into `dev` with a normal history-preserving merge; do not rebase or
  force-push the shared branch. At the audit snapshot, this sync was already
  satisfied.
- Do not start new feature work on `dev`. After the release, cut short-lived
  feature branches from `main` and open PRs into `main` under ADR 0037. Leaving
  the old `dev` ref available temporarily does not make it an active target.
- CI continues to gate pull requests targeting `main`, including #1029. The
  workflow remains scoped to `main`; it does not add a second long-lived
  branch gate or run duplicate full checks on pushes to `dev`.
- Keep Vercel Git deployments disabled during the manual-release hold in ADR
  0051. An operator creates Production deployments from the Vercel Dashboard
  after CI passes; GitHub Actions validates code and does not deploy it. Keep
  the hold until a replacement release policy is approved and verified.
  Verify production configuration and post-release
  behavior using the checklist in PR #1029.
- Leave changing GitHub's default branch, configuring required checks, and
  deleting the now-inactive `dev` ref to a separately reviewed operator task.
  Track dashboard verification in #732; the current API connection cannot
  read those settings.

## Consequences

The consolidation keeps Jules work reviewable in one release proposal while
restoring the intended one-long-lived-branch workflow afterward. #1029 remains
the release boundary and must carry a verified change summary, local gate
results, compatibility risks, and explicit post-outage checks. CI and branch
protection state must not be described as verified until the relevant checks
and dashboard settings can be read.

## Alternatives Considered

- **Keep `dev` as a permanent staging branch:** rejected because the current
  branch is a recovery mechanism for this Jules consolidation, and a second
  long-lived queue would add ongoing synchronization and release overhead.
- **Discard the Jules consolidation and rebuild it from separate PRs:**
  rejected because that would lose traceability and repeat already-integrated
  work without reducing the actual release risk.
- **Rebase or force-push `dev` to make the graph look linear:** rejected
  because it rewrites shared history and is unnecessary for the release.
