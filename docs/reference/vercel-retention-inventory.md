# Vercel Retention Inventory

Last verified: 2026-09-12 23:31 UTC

Scope: `laser-loons-projects/portfolio`, Vercel Hobby, last 30 days

Sources: Vercel usage dashboard, deployment API, and Vercel CLI

This is the post-cleanup capacity and retention record for
[Issue #691](https://github.com/fderuiter/portfolio/issues/691) and closed
[Issue #692](https://github.com/fderuiter/portfolio/issues/692).

> [!WARNING]
> This page is a dated snapshot, not current Vercel state. A 2026-09-22
> refresh was blocked because the workstation CLI token was invalid and the
> connected Vercel app lacked access to the linked team. Do not make a release,
> cleanup, or capacity decision from these figures until authenticated provider
> access is restored and every meter, deployment, and alias is re-read.

## Capacity Snapshot

| Meter | Used | Limit | Remaining | Status |
| --- | ---: | ---: | ---: | --- |
| Functions Storage | **9.68 GB** | 10.00 GB | 0.32 GB (3.2%) | Critical |
| Deployment Storage | **6.20 GB** | 10.00 GB | 3.80 GB (38.0%) | Healthy |
| Build Time | **87.0 hrs** | 100.0 hrs | 13.0 hrs (13.0%) | Warning |

Functions Storage is a GB-month meter. Removing deployments prevents future
retention but does not erase the daily maximum already recorded in the current
billing window. Deleted successful deployments also enter Vercel's recovery
period, and protected-deployment reevaluation can take time. A same-day meter
drop is therefore not an appropriate cleanup success criterion.

## Deployment Inventory Captured 2026-09-12

The final paginated audit returned 268 records for `portfolio`:

| State | Count |
| --- | ---: |
| `READY` | 43 |
| `BLOCKED` | 190 |
| `ERROR` | 32 |
| `CANCELED` | 3 |

The 43 retained `READY` records comprise 20 production and 23 preview
deployments. The visible team inventory contains no separate
`wedding-website` Vercel project, so earlier wedding contribution estimates
are retained only in source history and must not drive current cleanup.

## Cleanup Record

On 2026-09-12 the operator explicitly approved the audited cleanup. Vercel
accepted removal of 57 superseded, unaliased deployments:

- 36 stale preview deployments;
- 21 superseded production deployments outside the protected set.

The canonical domain returned HTTP 200 after both phases. The production
deployment identified at capture time remained protected:

| Deployment ID | Environment | Branch | Purpose |
| --- | --- | --- | --- |
| `dpl_3VVso5GPXhpejKjb5wGRFszJABfa` | Production | `main` | Canonical target at the 2026-09-12 capture |

The post-cleanup audit found **zero additional conservative deletion
candidates**. The original review candidates remain in
`HISTORICAL_REVIEW_CANDIDATES_2026_09_12` in
`scripts/vercel-retention-inventory.ts` as an audit record; they are not a live
deletion queue.

## Verification Gap Recorded 2026-09-22

The public site was reachable, but the private Vercel control plane was not:

- global Vercel CLI `41.6.1` rejected its stored token as invalid;
- the connected Vercel app returned `403` for the linked team;
- the production HTML reported Sentry release `dc133b59`, 64 commits behind
  audited `main` (`7fb7e666`);
- apex routing worked (`www` returned `308` to the apex), while canonical,
  OpenGraph, robots, and sitemap output still used `www`;
- production page responses were private/no-store cache misses, while the
  exact audited `main` build returned prerendered cache hits with
  `s-maxage=3600`.

These observations prove deployment drift but do not reveal the current
deployment ID, alias target, storage meter, build-time meter, environment
inventory, or runtime-error state. See the
[2026-09-22 readiness audit](../explanation/audits/2026-09-22-release-public-vercel-readiness.md).

## Retention Rules

Before any future deletion:

1. Resolve the canonical production alias and exclude its target.
2. Exclude every aliased deployment and every active pull-request target.
3. Preserve Vercel's mandatory latest-deployment and active-branch exceptions.
4. Preserve at least the current and immediately previous known-good
   production deployments for rollback.
5. Rebuild the candidate set from live paginated data. Never reuse the
   historical list.
6. Obtain explicit operator authorization for the resolved IDs.
7. Verify `https://deruiter.dev/` after deletion.

The approved 2026-09-12 cleanup does not authorize deleting future
deployments, aliases, projects, integrations, or provider resources.

## Prevention Policy

- During the manual hold, all Git-triggered Vercel deployments are disabled
  and an operator starts Production from the Dashboard after CI passes (ADR 0051).
- Keep the hold until a replacement release policy is approved and verified;
  the nightly-train proposal is tracked in issue #1168.
- Retention remains one day for production and canceled deployments and seven
  days for preview and error deployments, subject to Vercel exceptions.
- One operator-created preview may be used for a high-risk review, then its
  branch and alias are removed after merge.
- Function bundle composition is audited separately from deployment count.

See [ADR 0037](../../adr/0037-controlled-integration-and-release-deployments.md)
and the [release workflow](../how-to/release-and-deploy.md).

## Verification Commands

```bash
npm run inventory:vercel
npm run inventory:vercel -- --json
npm run headroom:vercel
```

The scripts contain the verified 2026-09-12 snapshot, not a live Vercel
credential. `scripts/vercel-headroom.ts` currently defaults its evaluation
clock to that same fixed date, so its `stale` field does not age naturally.
Refresh the snapshot from the dashboard and API before making capacity
decisions, and compare the capture timestamp manually until that defect is
fixed.
