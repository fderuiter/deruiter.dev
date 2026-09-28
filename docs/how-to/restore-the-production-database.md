# Restore the Production Database

Last verified: 2026-09-19 16:11 UTC, by executing a full restore against the live
Neon project `neon-gray-drum` (`withered-tooth-11857430`).

Governing policy: [ADR 0036](../../adr/0036-free-tier-offloading-and-provider-quota-governance.md),
[Issue #700](https://github.com/fderuiter/portfolio/issues/700),
[Issue #622](https://github.com/fderuiter/portfolio/issues/622).

Every figure below was measured during that rehearsal. Nothing here is estimated.

## Read this first

> [!CAUTION]
> **Neon's restore defaults to a production cutover.** `restore_snapshot` takes a
> `finalize` flag that **defaults to `true` when restoring as a new branch**. That
> is not "create a branch to inspect". It atomically:
>
> - renames the restored branch to the source branch's name (`main`),
> - moves the `primary` and `default` flags onto it,
> - moves the **production compute endpoint** onto it,
> - demotes and renames the branch that was production.
>
> If you want an isolated target to verify *before* committing, you must pass
> `finalize: false` and call `finalize_branch_restore` as a separate, deliberate
> step. The rehearsal on 2026-09-19 cut production over by accepting the default.

The second surprise follows from the first, and matters just as much during an
incident:

> [!IMPORTANT]
> **Production depends on the compute endpoint, not the branch id.** Nine
> environment variables name `ep-young-mouse-ap1zkh0m`. The branch id appears in
> exactly two places in this repository. When the two disagree, the endpoint wins:
> whichever branch holds that endpoint is production, whatever it is called.

## Recovery objectives

| Objective | Value | Basis |
| --- | --- | --- |
| **RPO** | **≤ 6 hours** | `history_retention_seconds: 21600` on the Neon free plan. There is no longer window and there are **zero snapshots** configured, so this is the only recovery mechanism that exists. |
| **RTO** | **≈ 64 seconds** | Measured 2026-09-19, decision to queryable database. |

RTO breakdown, from Neon's own operation timestamps:

| Step | Elapsed |
| --- | --- |
| Create snapshot at a past timestamp | 5s |
| Restore to branch `ready` | 28s |
| Compute cold start to queryable | 31s |
| **Total** | **~64s** |

RTO is bounded by compute cold start, not by data volume — the database is 30.8
MiB of 512 MiB and restore is copy-on-write. Expect this figure to hold as the
database grows.

## Limitations you cannot engineer around on this plan

1. **Six hours is the whole window.** An incident discovered on a Monday morning
   that began Sunday night is not recoverable. This is the single largest gap in
   the recovery posture and no procedure below mitigates it.
2. **No snapshot schedule exists.** `list_snapshots` returns `[]`. Manual
   snapshots are possible and expire; nothing creates them automatically.
3. **One role, no least privilege.** `neondb_owner` has full read/write and is
   what the application runs as. There is no migration-only or read-only role.
   See [#622](https://github.com/fderuiter/portfolio/issues/622).
4. **No network restriction.** `allowed_ips: []`, `block_public_connections: false`.
   A leaked credential is usable from anywhere — see
   [#865](https://github.com/fderuiter/portfolio/issues/865).
5. **Ten branches maximum** on the free plan. Rehearsal branches must be cleaned up.
6. **The production branch is not protected.** `"protected": false`. Nothing at
   the provider prevents deleting it.

## Procedure

### 1. Capture the pre-restore baseline

Run these against the **current** production branch before changing anything.
Record both fingerprints; they are how you prove the restore was faithful.

```sql
SELECT md5(string_agg(sig, '|' ORDER BY sig)) AS schema_fingerprint,
       count(*) AS column_count
FROM (SELECT table_schema||'.'||table_name||'.'||column_name||':'||data_type||':'||is_nullable AS sig
      FROM information_schema.columns
      WHERE table_schema IN ('public','neon_auth')) s;
```

```sql
SELECT md5(string_agg(slug||':'||title||':'||published::text, '|' ORDER BY slug)) AS casestudy_fingerprint,
       count(*) AS n
FROM public."CaseStudy";
```

Values observed 2026-09-19, for comparison:

| Fingerprint | Value |
| --- | --- |
| Schema (155 columns) | `800a41c74b9eb8fb31798631812e007d` |
| CaseStudy (4 rows) | `90eb59844b848b1cbe4ef4a8b45603e9` |

Row counts were CaseStudy 4, TelemetryEvent 94, `_prisma_migrations` 11,
everything else 0.

### 2. Choose a restore point inside the window

```bash
date -u -v-6H '+%Y-%m-%dT%H:%M:%SZ'   # retention floor - nothing older exists
```

Pick a timestamp after that floor and before the incident began.

### 3. Create a snapshot at that timestamp

Always set `expires_at` so a forgotten rehearsal cannot consume a branch slot
indefinitely.

```text
create_snapshot(
  project_id  = "withered-tooth-11857430",
  branch_id   = <current production branch id>,
  name        = "dr-<reason>-<date>",
  timestamp   = "<restore point>",
  expires_at  = "<restore point + 6h>"
)
```

### 4. Restore — deliberately choosing cutover or inspection

**To inspect first (default for a rehearsal or an uncertain incident):**

```text
restore_snapshot(
  project_id  = "withered-tooth-11857430",
  snapshot_id = <from step 3>,
  name        = "dr-<reason>-restore",
  finalize    = false
)
```

**To cut production over immediately (only when the restore point is certain):**

```text
restore_snapshot(..., finalize = true)   # or omit finalize - true is the default
```

### 5. Verify before cutting over

Re-run both queries from step 1 against the restored branch, passing its
`branch_id`. Schema and data fingerprints must match the baseline exactly, unless
the incident being recovered from is itself a data change — in which case the
CaseStudy fingerprint should differ and the schema fingerprint should not.

Then verify application connectivity against the restored branch, not just raw
SQL. `_prisma_migrations` must contain 11 rows; a mismatch means the restore
point predates a migration and the application code will not match the schema.

### 6. Cut over

If you restored with `finalize: false`, call `finalize_branch_restore` now.

Confirm the endpoint actually moved — **this is the step most likely to surprise
you**:

```text
list_branch_computes(project_id = "...", branch_id = <restored branch>)
```

The result must contain `ep-young-mouse-ap1zkh0m`. If it does not, production is
still served by the old branch and the cutover has not happened regardless of
which branch is named `main`.

### 7. Verify production end to end

Two case-study slugs exist **only in the database** and in none of the 22 static
fallbacks in `lib/case-studies-data.ts`. They are the only reliable way to tell a
database-backed render from a fallback render:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://deruiter.dev/case-studies/equipose
curl -sS -o /dev/null -w "%{http_code}\n" https://deruiter.dev/case-studies/qrcraftly
```

`200` means the running deployment reached Neon. `404` means it is serving
fallbacks — the failure mode of
[#859](https://github.com/fderuiter/portfolio/issues/859), which otherwise looks
like a healthy site.

> [!NOTE]
> Do **not** use the blog for this check. `BlogPost` has zero rows, and
> `BlogPostService` merges static fallbacks for any slug absent from the database
> through its **success** path. The blog therefore renders identical content
> whether or not the database was reachable.

## Rollback

Rollback is symmetric with cutover and equally constrained.

1. The pre-restore branch is retained with its data intact. Do not delete it until
   the restore is confirmed in production.
2. Neon **refuses to delete the read-write endpoint of the root branch**, and
   **refuses to add a second read-write endpoint** to a branch that has one. These
   two rules together mean a live endpoint cannot simply be moved back.
3. `set_default_branch` moves the `primary`/`default` designation **but not the
   compute endpoint**. Calling it alone leaves the endpoint on the other branch
   and production pointing somewhere the name does not suggest.
4. The reliable rollback is therefore to **rename branches so that the branch
   already holding `ep-young-mouse-ap1zkh0m` is called `main`**, then set default
   to it, then update the two repository artifacts in the next section. Renaming
   is instant and never touches a live endpoint.

Relocating the endpoint itself requires temporarily flipping the default branch
and deleting the displaced endpoint, and operates on live production. Prefer
renaming.

## Credential and connection cutover

No connection string changes if the endpoint moves with the branch, because Neon
connection strings address the **endpoint host**, not the branch.

If the endpoint id does change, these **nine** variables carry the host and must
all be updated in Vercel (Production **and** Preview) and in local `.env.local`:

`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGHOST_UNPOOLED`,
`POSTGRES_HOST`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`,
`POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`

This is **not** the same set as the eight password-bearing variables in
[#865](https://github.com/fderuiter/portfolio/issues/865). `PGPASSWORD` and
`POSTGRES_PASSWORD` carry the password but no host; `PGHOST`, `PGHOST_UNPOOLED`
and `POSTGRES_HOST` carry the host but no password. A rotation and an endpoint
move touch overlapping but different lists.

> [!WARNING]
> **Vercel binds environment variables at deploy time.** Changing a variable has
> no effect on the running deployment. During the manual hold, create a Production
> deployment from the current green `main` SHA in Dashboard → Deployments →
> Create Deployment after any change here; production remains a deliberate
> human action.

## Repository artifacts that name the branch id

Two files record the production branch id and must be updated whenever it
changes. Both are recorded snapshots, not live queries, so they drift silently.

1. `scripts/neon-capacity-inventory.ts` — the `branchId` field of the production
   branch entry.
2. `docs/reference/neon-capacity-inventory.md` — the inventory table row.

## Rehearsal ownership and cleanup

| Item | Id | Disposition |
| --- | --- | --- |
| Rehearsal snapshot | `snap-round-flower-apoxv1sy` | Expires 2026-09-19 21:58 UTC |
| Retained former production branch | `br-shiny-dust-apixoyf1` (`pre-rehearsal-main-2026-09-19`) | Operator deletion once release v0.3.x is confirmed |

Owner: repository maintainer. Because history retention is six hours, the
retained branch confers **no** recovery advantage over `main` once both are older
than that window; it is a convenience copy, not a backup.

## What this rehearsal did not cover

- Restoring into a target that was **never** promoted to production. The 2026-09-19
  run cut over, so the isolated-inspection path (`finalize: false` followed by
  verification and then discard) remains unexercised.
- Recovery from a schema-destructive incident. Data and schema were identical
  before and after, so the procedure is proven faithful but not proven corrective.
- Any incident older than six hours, which is not recoverable on this plan.
