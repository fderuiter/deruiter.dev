# ADR 0039: GitHub Plan Capabilities and Actions Governance

## Status

Accepted on 2026-09-13. **Corrected on 2026-09-18 and amended on 2026-09-24.**
The account is on GitHub Free. The repository became public on 2026-09-23,
which restores public-repository branch protection and rulesets and makes
standard GitHub-hosted runner minutes free. Actual branch-rule configuration
remains unverified and is tracked by #732. See
[Amendment 2026-09-24](#amendment-2026-09-24--public-repository-state).

Extends ADR 0036's free-tier governance pattern to a resource ADR 0036 does
not cover: GitHub Actions minutes. Its attempt to correct ADR 0037's context
section was itself the error — ADR 0037 was right.

## Context

> [!CAUTION]
> **Superseded (2026-09-18):** The plan claim in this paragraph and the
> 3,000-minute figure below are both false. The account is on GitHub
> **Free**, with a **2,000**-minute private-repository allowance and no
> branch-protection, ruleset, or environment-protection capability. See
> [Correction 2026-09-18](#correction-2026-09-18). Everything in this
> section about _cost behavior_ — cancelled jobs billing full elapsed time,
> duplicate same-tree runs, matrix breadth as a cost multiplier — remains
> accurate and is unaffected.

The account owning `fderuiter/portfolio` is on **GitHub Pro**, not GitHub
Free. This was not established at the time ADR 0037 was written; its context
section states private-repo branch protection is unavailable, which was true
against a Free-plan assumption but is not true on Pro. GitHub Pro grants
private repositories classic branch protection rules, repository rulesets,
and environment protection rules (required reviewers, wait timers, branch
restrictions) — the exact capabilities the 2026-09-12 governance audit
(`docs/explanation/audits/2026-09-12-github-vercel-release-governance.md`)
flagged as blocked pending a plan decision. That decision is now made.

GitHub Pro's private-repository entitlement is **3,000 Actions minutes per
month** on standard (Linux) runners at a 1x billing multiplier, with **no
authorization for any paid overage**: this repository does not purchase
additional minutes or raise a spending limit. That is a hard operating
constraint, not a preference, and it governs every workflow change from here
forward the same way Vercel Hobby's 100 build-hours and one-cron-per-day
limits already govern deployment and scheduling design in ADR 0036.

This constraint was not previously written down anywhere, and the repository
found it the expensive way. In the 24 hours before this ADR, `.github/workflows/ci.yml`'s
single `rigor-pipeline` job — Playwright across four device projects, no
scope reduction between a PR check and the post-merge `main` push — was
cancelled at its job-timeout cap multiple times while iterating toward a fix
(runs on 2026-09-13: cancelled at 34m41s under a 45-minute cap, cancelled
again at 58m39s under a raised 70-minute cap, cancelled a third time on the
`main` post-merge run at 56 minutes elapsed). GitHub bills the full elapsed
runner time for a cancelled job, not zero. Every pull request additionally
re-ran the identical full-matrix suite twice — once for the PR check, once
again for the `main` push after squash-merge — for code that had not
changed between the two runs. By the time three follow-up PRs (#729, #730, #731)
were opened the same day, their `CI Pipeline` runs failed in 2-4 seconds with
`0` billable milliseconds on every job: GitHub Actions minutes
for the account's current billing cycle were exhausted.

## Decision

### 1. Branch protection is now an enforceable invariant, not a future option

Configure GitHub branch protection on `main` (Settings → Branches): require
a pull request before merging, require the `Rigor Ecosystem (Logic, Visual,
Performance)` and `Security Gate (Vulnerability Audit)` status checks,
require branches to be up to date, block force pushes, block deletion. This
replaces the client-side-only guardrails (`​.husky/pre-push`, `CODEOWNERS`)
ADR 0037 and ADR 0038 relied on as a substitute for server-side enforcement.
The client-side guardrails remain as defense-in-depth; they are not removed.

> [!NOTE]
> **Superseded (2026-09-14):** Requiring `Rigor Ecosystem (Logic, Visual,
Performance)` reflected the pre-#775 monolithic pipeline. When the workflow
> was partitioned, requiring individual tiered jobs (`heavy-gate`, `device-gate`)
> directly proved unsafe because GitHub branch protection treats skipped checks
> as passing. Under CI-02 (#779) and CI-03 (#781), branch protection policy was
> updated to require the single fail-closed summary check **`Merge Gate (Required
Checks Summary)`** (job ID `merge-gate`). See the 2026-09-14 update below and
> [docs/how-to/monitor-github-actions-minutes.md](../docs/how-to/monitor-github-actions-minutes.md).

This decision also covered the GitHub release environment:

> [!NOTE]
> **Superseded (2026-09-24):** [ADR 0049](0049-deploy-main-on-green-ci.md)
> removed the GitHub release workflow and its environment; Vercel's Git
> integration now builds and promotes `main`. The original text follows.
>
> Configure the `production-release` GitHub Environment (used by
> `.github/workflows/release.yml`) with required reviewers, which Free-plan
> private repositories cannot do but Pro can. This closes the gap ADR 0038
> left open: the protected-release job currently has no server-side approval
> gate, only the convention that a human must click "Run workflow."

### 2. GitHub Actions minutes are a governed quota, tracked the same way as every other provider in ADR 0036

Extend ADR 0036's pattern — explicit budget, defense-in-depth protection,
no silent overage — to GitHub Actions:

- **No paid overage, ever.** A workflow redesign that trades engineering
  effort for Actions minutes is always preferred over spending money on
  more minutes. If minutes are exhausted before the monthly reset, CI stays
  down until reset; this is an accepted consequence, not an emergency to
  solve by upgrading further.
- **Every required check must have a job-level `timeout-minutes` bound
  low enough that one hang cannot consume a meaningful fraction of the
  monthly allowance.** A hang that is merely capped at "safe" is not
  sufficient if the cap itself is expensive; the cap bounds diagnosability,
  not cost, so cost must be bounded separately by scope reduction (below).
- **Full-matrix, full-suite E2E execution is expensive and must not run
  twice for the same tree.** Concretely: a PR's own CI run is the gate;
  the subsequent `main` push after squash-merge validates the identical
  code the PR already validated. Re-running the full Playwright matrix a
  second time on that push spends minutes without checking anything new.
- **Device-matrix breadth is a cost multiplier, not a free correctness
  improvement.** Running all four configured Playwright projects
  (`chromium`, `Tablet Safari`, `Mobile Safari`, `Mobile Chrome`) against
  the full `__tests__/e2e/` suite on every PR push multiplies wall-clock
  (and therefore billed) time by four for coverage that mostly does not
  vary by device for non-visual, non-viewport-specific specs.
- **A monthly Actions-minutes check is a documented operational habit**,
  the same way Vercel headroom is (`docs/how-to/monitor-vercel-headroom.md`,
  `scripts/vercel-headroom.ts`). No equivalent script exists yet for GitHub
  Actions; until one does, check Settings → Billing → Actions manually
  before merging anything expected to trigger several CI runs in one day.

The concrete engineering plan implementing this decision — the specific
`ci.yml` restructuring (tiered fast/heavy gates, matrix reduction, removing
the redundant post-merge re-run, timeout ratcheting once a real run confirms
the honest post-#731 runtime) — is tracked as its own issue rather than
decided here, because the right shape depends on measuring one clean CI run
after minutes reset, not on guessing further from a starved account.

## Consequences

- Branch protection and environment protection rules can be configured
  immediately; this ADR removes the plan-decision blocker ADR 0037/0038 and
  the 2026-09-12 audit left open. #732 is corrected to reflect this rather
  than presenting it as a cost/upgrade decision still to be made.
- **Historical at the 2026-09-12 private-repository outage:** no further CI
  runs were possible until the Actions-minutes allowance reset or the
  follow-up redesign reduced per-run cost. The repository became public on
  2026-09-23; the 2026-09-24 amendment below records the current public-runner
  policy and supersedes that temporary outage state (#729, #730, #731).
- Every future workflow change must state its expected cost impact (jobs ×
  matrix size × expected duration) the same way a database migration states
  its lock behavior — cost is now a reviewed property of CI changes, not an
  afterthought discovered via exhaustion.
- ADR 0037's context section describing branch protection as unavailable is
  superseded by this ADR for that specific claim; ADR 0037's branch-topology
  decision (single trunk, short-lived topic branches) is unaffected and
  remains active.

## Update 2026-09-14

The follow-up engineering plan is implemented in `.github/workflows/ci.yml`:
the pipeline splits `fast-gate` (typecheck, lint, docs/schema drift, unit tests,
property fuzzing — push and PR), `security-gate` (vulnerability audit — push and
PR), `heavy-gate` (build, bundle budget, Playwright chromium, Web Vitals — PR-only),
and `device-gate` (the two device-engine-dependent specs against the three
non-chromium projects — PR-only).

Under CI-02 (#779), `device-gate` was relocated pre-merge to pull requests
alongside `heavy-gate`, superseding the intermediate `post-merge-device-smoke` concept
so that cross-device visual and touch regressions gate the merge rather than
running after landing on `main`. Under CI-03 (#781), `merge-gate` (`Merge Gate
(Required Checks Summary)`) was configured to run unconditionally (`if: always()`)
and fail closed: on `pull_request` it asserts that all four gating jobs succeeded;
on `push` to `main` it provides bounded confirmation requiring `fast-gate` and
`security-gate`; on any unhandled trigger (including `workflow_dispatch`) it fails
deliberately with an explicit error. Branch protection on `main` must require
**`Merge Gate (Required Checks Summary)`** rather than the retired `Rigor
Ecosystem` check. The full four-device matrix remains available on demand via
`cross-device-matrix` (`workflow_dispatch`-only).

### Implementation Evidence, Server Settings, and Deferred Measurements

1. **Local Implementation Evidence**: Workflow topology, dependencies (`needs:`),
   and the fail-closed evaluation logic of `merge-gate` are validated locally
   by offline unit and shell execution test suites
   (`__tests__/ci-execution-policy.test.ts` and `__tests__/ci-gate-ordering.test.ts`).
2. **Unverified Server-Side Protection**: While branch protection rules on `main`
   (requiring `Merge Gate (Required Checks Summary)`) constitute required repository policy,
   their enforcement on GitHub's servers remains an unverified administrative configuration
   pending manual confirmation in repository settings.

   > **Superseded (2026-09-24):** this item also required environment protection
   > rules on `production-release` (requiring reviewers).
   > [ADR 0049](0049-deploy-main-on-green-ci.md) removed that environment.

3. **Historical Measurement Note (superseded 2026-09-24)**: Job `timeout-minutes` caps (`fast-gate`: 20,
   `security-gate`: 15, `heavy-gate`: 40, `device-gate`: 25, `merge-gate`: 5) remain
   provisional estimates rather than verified runtime measurements. At the time
   this section was written, the private-repository Actions allowance was
   exhausted and runs were deferred. The repository became public on 2026-09-23;
   standard public-runner minutes are free, so the old allowance is no longer a
   current reason to defer runs. Review successful run durations before changing
   timeout caps. Larger runners and artifact/cache storage remain separately
   billable as described in the 2026-09-24 amendment below.

## Correction 2026-09-18

This ADR's central factual premise is wrong. The account owning
`fderuiter/portfolio` is on **GitHub Free**, not GitHub Pro. ADR 0037's
original context section — which this ADR set out to correct — was accurate.

### Evidence

| Probe                                                     | Result                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /user`                                               | `plan.name = "free"`                                                                 |
| `GET /repos/fderuiter/portfolio/branches/main/protection` | `403 "Upgrade to GitHub Pro or make this repository public to enable this feature."` |
| `GET /repos/fderuiter/portfolio/rulesets`                 | same `403`                                                                           |
| `GET /repos/fderuiter/portfolio/environments`             | 3 environments exist, all with `protection_rules: []`                                |

### What changes

**Decision §1 (branch protection) is not achievable and is withdrawn as an
actionable decision.** Classic branch protection, repository rulesets, and
environment protection rules all require Pro on a private repository. The
client-side guardrails (`.husky/pre-push`, `CODEOWNERS`,
`scripts/git-guardrail.sh`) are therefore not defense-in-depth layered over
server-side enforcement, as §1 assumed — **they are the only enforcement
that exists.** Any document asserting server-side branch protection on
`main` is describing a control that is not in place. Restoring Actions
minutes does not change this; only a plan change or making the repository
public would.

**Decision §2 (Actions-minutes governance) stands, with a tighter budget.**
The private-repository allowance is **2,000 minutes/month**, not 3,000 — the
real budget is one third smaller than every downstream document has stated.
The no-paid-overage invariant is unchanged and was applied as written when
the allowance was exhausted a second time.

### Historical Second Exhaustion, 2026-09-13

The allowance was exhausted again in the same billing cycle this ADR was
written in, by the same mechanism. September private-repository consumption
reached **2,433 minutes against a 2,000-minute allowance (122%)**, crossing
the ceiling on 2026-09-13. Net billable amount was **$0.00** — nothing was
purchased, confirming this was allowance exhaustion rather than a payment
failure, a distinction the failing-job annotation does not disambiguate.

`portfolio` accounted for **1,847 of the 2,433 private minutes (76%)**, and
on 2026-09-13 alone ran **45 CI Pipeline runs for 625 minutes** — 31% of the
entire monthly allowance in one day. Full analysis in #840.

### The duplicate-run defect was misdiagnosed

Decision §2 identified full-matrix E2E re-execution across a PR check and
its post-merge `main` push as the duplication to eliminate, and the
2026-09-14 update fixed exactly that: `heavy-gate` and `device-gate` are
now `if: github.event_name == 'pull_request'`.

That fix is correct and holds. But it did not eliminate same-tree
duplication, because `fast-gate` (20m cap) and `security-gate` (15m cap)
still run on **both** the `pull_request` event and the post-merge `push` to
`main`. Since merges are squash merges, the `main` run validates a tree the
PR gate already validated — roughly 35-40 minutes of capped duplicate work
per merge.

This was compounded by `concurrency.cancel-in-progress` being
`${{ github.event_name == 'pull_request' }}`, i.e. **false for `main`
pushes**, so consecutive merges produced consecutive complete non-superseding
runs rather than superseding one another. The fourteen `main` pushes on
2026-09-13 each got a full run.

The concurrency asymmetry is corrected in this change. Whether to drop the
post-merge `fast-gate`/`security-gate` duplicate entirely is a separate
decision: it is the larger saving, but it removes the only post-merge signal
on the branch Vercel deploys from, and unlike a PR gate there is no branch
protection available to compensate.

### Historical Deferred Measurement Note

Job `timeout-minutes` caps remain provisional. Every job in every workflow
declares one — audited 2026-09-18, no unbounded job exists — but the caps
are loose relative to a 2,000-minute budget: a single hung PR run can reach
105 minutes (5.3% of the monthly allowance) and a hung `verify-release`
reaches 90 (4.5%). Ratcheting them down requires one clean measured run and
was previously assigned to #733; tightening them by guess would trade cost
risk for false-failure risk. Review successful current runs before ratcheting.

## Amendment 2026-09-24 — Public Repository State

The repository changed from private to public on 2026-09-23. The 2026-09-18
correction remains an accurate historical record of the then-private GitHub
Free plan, but its private-repository restrictions no longer describe the
current repository:

- Standard GitHub-hosted runner usage is free for public repositories. Larger
  runners and artifact/cache storage remain subject to separate billing and
  limits. Do not describe the private 2,000-minute allowance or the September
  exhaustion as a current standard-runner limit.
- Public repositories on GitHub Free can use classic branch protection and
  repository rulesets. The current rule configuration is not confirmed: the
  connected GitHub API could not read branch-protection settings. Verify the
  `main` required check and merge restrictions in the dashboard under #732
  before relying on server-side enforcement.
- Keep job timeouts, standard runner labels, and the no-duplicate-gating rule
  as reliability and resource-storage safeguards. The no-paid-overage policy
  continues to apply to larger runners and paid storage.
- ADR 0050 records the one-time Jules consolidation on `dev`; after that
  release, feature pull requests target `main` under ADR 0037.

These current facts are supported by GitHub's
[Actions billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[protected branches documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches),
and [rulesets documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

## Amendment 2026-10-02 — Parallel Gates and One Build per Pull Request (#1767)

The job names above describe the pipeline as it was. #1767 reshaped it to
cut the pull request critical path from about 33 minutes to a target of 13
to 16, without removing a gate or lowering a threshold:

- `fast-gate` became `static-gate`, `unit-gate` (three Vitest shards, merged
  by `unit-coverage`, which enforces the coverage thresholds) and
  `mutation-gate` (Stryker, incremental against `main`'s report, with a
  weekly full run in `mutation-weekly.yml`).
- A `build` job runs `npm run build` once per pull request. `heavy-gate`
  (three chromium shards), `bench-gate` and `device-gate` use its artifact.
  `bench-gate` runs the full `npm run verify` right after it writes the
  benchmark evidence, and `heavy-gate-report` merges the shard reports and
  applies the accessibility gate.
- Every browser job runs in the official Playwright image, pinned by digest
  to the locked `@playwright/test` version, so no job downloads browsers or
  runs apt (#1771). The Postgres service image is pinned by digest too.
- A `changes` job applies the run policy in `scripts/ci-run-policy.mjs`:
  docs-only pull requests skip the browser gates, drafts skip them until
  marked ready, and bot branches run only `static-gate` and `security-gate`
  until a maintainer applies the `ci:full` label.
- A non-gating `cache-warm` job writes the `main` webpack cache that pull
  request builds fall back to.

The invariants of this ADR are unchanged: `Merge Gate (Required Checks
Summary)` stays the single required check and fails closed, every job runs
on `ubuntu-latest` with `timeout-minutes`, third-party actions are pinned by
SHA and container images by digest, and the concurrency group still matches `cancel-closed-pr-ci.yml`.
[Monitor GitHub Actions Minutes](../docs/how-to/monitor-github-actions-minutes.md)
lists the current jobs and which pull requests run which gates.
