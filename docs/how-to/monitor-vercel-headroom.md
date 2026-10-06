# Monitor Vercel Storage and Build Headroom

Documentation last reconciled: 2026-09-29. Meter data last verified:
2026-09-12 23:31 UTC against Vercel Hobby.

Governing policy: [ADR 0036](../../adr/0036-free-tier-offloading-and-provider-quota-governance.md),
[Issue #691](https://github.com/fderuiter/deruiter.dev/issues/691), closed
[Issue #692](https://github.com/fderuiter/deruiter.dev/issues/692), and
[Issue #698](https://github.com/fderuiter/deruiter.dev/issues/698).

## Inspect Headroom

```bash
npm run headroom:vercel
npm run headroom:vercel -- --json
npm run headroom:vercel -- --ledger
npm run headroom:vercel -- --strict
npm run inventory:vercel
```

`--strict` exits unsuccessfully for critical, stale, unreadable or unverified
meters. Evaluation uses the current clock; the checked-in snapshot retains its
original collection timestamp and is explicitly labeled `snapshot-budget`.
The table below records historical dashboard budgets, not verified current API
entitlements.

When `VERCEL_TOKEN` is configured, the tool optionally probes `/v6/deployments`
and `/v2/usage`. The usage response contract and quota availability have not
been verified. Probe observations are labeled `unverified-api-probe`, never
healthy release evidence. Missing units, invalid values and absent or malformed
limits remain unknown; historical 10 GB / 100 hour budgets are not substituted.
Schema-named byte/second fields and explicit compatible units are normalized
without magnitude guessing; GB and MB use decimal units.

The [official billing API](https://vercel.com/changelog/access-billing-usage-cost-data-api)
documents `/v1/billing/charges` billing records. Those records do not establish
this probe's storage quotas. Until a provider contract is verified, refresh the
audited snapshot from the dashboard with its collection timestamp. Without a
usable probe, reporting retains the dated snapshot and evaluates its age.

This is optional manual tooling. Production builds do not call the capacity
helper and do not require a new Vercel API credential. The helper fails on child
errors, malformed reports, unverified provenance or stale samples. No tool
starts or authorizes a deployment; the manual hold in ADR 0051 remains.

## Thresholds and Captured Snapshot

| Meter | Limit | Warning | Critical | 2026-09-12 usage |
| --- | ---: | ---: | ---: | ---: |
| Functions Storage | 10.00 GB | 8.00 GB | 9.50 GB | **9.68 GB** |
| Deployment Storage | 10.00 GB | 8.00 GB | 9.50 GB | **6.20 GB** |
| Build Time | 100.0 hours | 80.0 hours | 95.0 hours | **87.0 hours** |

- Healthy: below 80%.
- Warning: at least 80% and below 95%.
- Critical: at least 95%.
- Stale: the snapshot exceeds the configured maximum age (30 days).
- Unreadable: a provider value is missing or malformed; never interpret it as
  zero.

`HeadroomAlertManager` fingerprints alerts by resource and severity, applies a
cooldown, and emits a recovery notification when a resource returns to a
healthy band.

> [!NOTE]
> `scripts/vercel-headroom.ts` defaults its evaluation clock to real system execution time (`new Date()`). When evaluating against checked-in snapshot data without `VERCEL_TOKEN`, any snapshot older than the 30-day maximum age threshold is dynamically marked as `stale` (`[STALE]`).

## Critical Functions Storage Response

The 2026-09-12 cleanup removed 57 superseded deployments and closed
Issue #692. The GB-month meter may remain at 9.68 GB until its rolling accounting and
recovery state reconcile.

When the meter is critical:

1. Keep automatic Git deployments disabled until a replacement release
   policy is approved and verified per
   [ADR 0051](../../adr/0051-manual-production-releases.md).
2. Open the Vercel usage dashboard, select All Projects and Last 30 Days, and
   record all three meter values with a UTC timestamp.
3. Run a fresh paginated deployment and alias inventory.
4. Compare the result with
   [the retention inventory](../reference/vercel-retention-inventory.md).
5. Preserve current production, the immediately previous known-good
   production deployment, aliased targets, active reviews, and provider
   retention exceptions.
6. If new candidates remain, put their exact IDs and protection evidence in a
   new human-gated issue. A prior deletion approval is not reusable.
7. After approved deletion, verify the canonical domain and record the meter
   over subsequent days. Escalate to Vercel support if usage keeps increasing
   while successful deployment creation remains bounded.

## Warning Build-Time Response

1. During the temporary hold, confirm `vercel.json` sets
   `git.deploymentEnabled` to `false`. Keep that setting until the approved
   replacement release policy is verified.
2. Confirm no GitHub Action, Deploy Hook, or second integration also deploys
   the same commit.
3. Keep one Production build per accepted pull request, started manually from
   the current `main` SHA during the hold; use an on-demand preview only when
   deployed review materially reduces risk.
4. Review failed and canceled build frequency before changing retention.

## Refresh the Audited Snapshot

First establish read-only provider access. On 2026-09-22 the workstation's
global Vercel CLI (`41.6.1`) rejected its stored token, and the connected
Vercel app returned `403` for the linked team. Do not use
`.vercel/.env.production.local` as a token source; it contains sensitive
production configuration and no usable `VERCEL_TOKEN`.

After reauthorization, read the live dashboard and deployment API without
printing environment values. Confirm meter values, the canonical alias target,
the current/previous known-good deployments, recent errors, and retention
exceptions. Then update together:

- `scripts/vercel-headroom.ts`;
- `scripts/vercel-retention-inventory.ts`;
- this guide;
- `docs/reference/vercel-retention-inventory.md`;
- their focused tests.

Then run:

```bash
npm test -- __tests__/vercel-headroom.test.ts __tests__/vercel-retention-inventory.test.ts
npm run lint:docs
```

Do not deploy while the last-known Functions Storage reading is critical and
the live meter is unavailable. The
[2026-09-22 readiness audit](../explanation/audits/2026-09-22-release-public-vercel-readiness.md)
records the authorization gap and public production evidence.

## Provider Ledger

The same ledger tracks the free-tier boundaries recorded in ADR 0036 for
Vercel, Neon, Upstash, Resend, Clerk, and Sentry. An unavailable live meter is
recorded as unknown. The ledger is a governance aid, not proof that an
integration is connected; use the live integration and environment audit in
the [GitHub–Vercel governance report](../explanation/audits/2026-09-12-github-vercel-release-governance.md)
before enabling a provider in Preview or Production.
