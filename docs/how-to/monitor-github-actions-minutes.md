# Monitor GitHub Actions Minutes

Last verified: 2026-10-02 against GitHub repository metadata and current
workflow configuration (the #1767 job split). The repository is public; standard hosted-runner
minutes are free for public repositories.

Governing policy: [ADR 0039](../../adr/0039-github-pro-plan-capabilities-and-actions-minutes-governance.md).

## Why this exists

The repository is public, so standard GitHub-hosted runner minutes are free.
Keep using standard runner labels: larger runners are billable, and artifact
and cache storage have separate limits. Workflow timeouts, bounded device
coverage, and avoiding duplicate gating runs remain important operational
controls. On 2026-09-13 the previous single-job `.github/workflows/ci.yml`
design (full four-device Playwright matrix on every PR push, repeated
identically on the post-merge `main` push) exhausted the private-repository
allowance during one active day of iteration. #733 restructured the workflow
to reduce duplicate and unnecessary work. This page tracks workflow usage,
storage, and run duration, mirroring
[monitor-vercel-headroom.md](./monitor-vercel-headroom.md).

**Correction 2026-09-18:** this page previously stated that Actions billing
usage was not readable through the API and that checking it was a dashboard
action. That is wrong. The enhanced billing endpoint reads it directly, given
a token carrying the `user` scope (`gh auth refresh -h github.com -s user`):

```bash
gh api "/users/fderuiter/settings/billing/usage?year=2026&month=9"
```

The legacy `/settings/billing/actions` endpoint now returns `410 Gone` and
must not be used.

Two properties of the response matter and are easy to get wrong:

- **Only private repositories draw on the allowance.** Public repositories
  appear in the same response with their minutes fully discounted. Summing
  every `usageItems` entry overstates consumption several-fold, September
  2026 totalled 19,955 minutes across all repositories but only 2,433
  against the allowance. Filter by private repositories before summing.
- **`netAmount` is not a usage signal.** It stays `0.00` both when usage is
  comfortably inside the allowance and when the allowance is exhausted with
  a $0 spending limit, because in the latter case GitHub refuses the jobs
  rather than billing them. Measure `quantity` against the allowance; do not
  infer headroom from cost.

## Check before a heavy iteration day

Before merging or dispatching anything expected to trigger several CI runs in
one day (a run of follow-up PRs, several `workflow_dispatch` cross-device
runs, repeated pushes while chasing a flaky test):

1. Open **Settings → Billing → Actions minutes** for the account owning
   `fderuiter/portfolio` (organization or personal account billing settings,
   whichever holds this repository).
2. Confirm standard GitHub-hosted runners remain selected. Public-repository
   runner minutes are free; larger runners and artifact/cache storage may
   still incur costs or hit separate limits.
3. Prefer `heavy-gate`'s single-device PR shards over dispatching
   `cross-device-matrix` unless the change specifically needs the full matrix.
   Validate speculative fixes locally first (`npm run typecheck && npm run
   lint && npx playwright test --project=chromium <file>`).
4. Review run duration and storage independently of minutes; the free standard
   runner allowance does not make an unbounded job or artifact accumulation
   operationally safe.

## What changed to reduce cost (ADR 0039 / #733 / #1767)

Issue #1767 cut the pull request critical path from about 33 minutes to a target
of 13 to 16 by running work in parallel and building once, without removing
a gate or lowering a threshold:

- `changes` (Change Detection & Run Policy) runs
  `scripts/ci-run-policy.mjs` first, with no install. It decides whether the
  PR changes code, whether it is a draft, and whether it comes from a bot
  branch (#1773).
- `static-gate` (migration replay, schema drift, docs drift, `lint:docs`,
  typecheck, lint, and `npm run verify -- --skip-benchmark-evidence`) runs on
  every trigger with the Postgres service. It caches `tsconfig.tsbuildinfo`
  and `.eslintcache`; both are content-keyed, so a stale entry only skips
  unchanged files.
- `unit-gate` runs Vitest with coverage in three shards (`npm run
  test:ci:shard`), each with Chromium for the Mermaid corpus suite (#954).
  `unit-coverage` merges their blobs (`npm run test:ci:merge`) and enforces
  the `vitest.config.mts` thresholds on the combined result. Property fuzzing
  runs inside this suite.
- `mutation-gate` runs Stryker. PRs and `main` pushes run incrementally
  against the newest report a `main` push saved; a PR that changes Stryker's
  configuration or the lockfile forces a full run, and
  `mutation-weekly.yml` runs every mutant weekly (#1772).
- `security-gate` (vulnerability, license and secret audits) runs on every
  trigger.
- `build` runs `npm run build` once per PR after `static-gate`, checks the
  bundle budgets, and uploads the build as an artifact (#1769).
- `heavy-gate` runs the full chromium e2e suite in three shards against that
  artifact (#1770). `bench-gate` measures Web Vitals on the same build:
  `bench:pages --assert` validates `.next/build-provenance.json` instead of
  rebuilding, then runs the full `npm run verify` while that evidence is
  minutes old. `heavy-gate-report` merges the shard reports, lists tests
  that passed only on retry, and applies the accessibility gate.
- The browser jobs (`unit-gate` for the Mermaid corpus suite, the
  `heavy-gate` shards, `bench-gate`, `device-gate`, `cross-device-matrix`)
  run in `mcr.microsoft.com/playwright`, pinned by digest to the locked
  `@playwright/test` version, so none of them downloads a browser or runs
  apt (#1771). `__tests__/ci-toolchain-pinning.test.ts` fails when the image
  tag and the lockfile disagree, so bump them together.
- `device-gate` runs the two device-engine-dependent specs
  (`visual.spec.ts`, `touch-controls.spec.ts`) against the three non-chromium
  projects, on the same artifact.
- `cache-warm` runs only on `main` pushes and is not a gate. It saves the
  `main` webpack cache that PR builds fall back to, because a PR's own
  caches are invisible to other PRs (#1769).
- `merge-gate` is the required-checks summary job: it `needs:` every gate
  above and fails unless each one that should run for the event reported
  success. See the [required check
  contract](#required-check-contract-for-branch-protection-732) below.
- `cross-device-matrix` (the full four-device matrix against the full suite)
  is `workflow_dispatch`-only, for a release or a device-sensitive change
  that specifically warrants it.
- The one-time Jules consolidation PR (#1029) used the same required pre-merge
  gates as other changes and has landed. All work targets `main`; the retired
  `dev` branch is not a CI target (see [ADR 0050](../../adr/0050-jules-consolidation-release.md)).

### Which gates run for which pull request (#1773)

| Pull request | Runs | Merge Gate |
| --- | --- | --- |
| Code change, ready for review | Every gate | Green when every gate passes |
| Docs-only change | Every gate except `build`, `heavy-gate`, `bench-gate`, `heavy-gate-report`, `device-gate` | Green when the rest pass |
| Draft | Static, unit, mutation and security gates | Red until marked ready, which re-runs everything |
| Bot branch (`stitch/`, `jules/`) without `ci:full` | Static and security gates only | Red: "bot PR: full suite runs when marked ready" |
| Bot branch with the `ci:full` label | Every gate the change needs | Green when they pass |

A change is docs-only when every changed file is on the explicit allowlist
in `scripts/ci-run-policy.mjs`: Markdown outside the app source directories,
`adr/`, `docs/`, `.github/ISSUE_TEMPLATE/`, `.agents/skills/`, and a few
named files. Any other path counts as code. To promote a bot PR, a
maintainer applies the `ci:full` label; the `labeled` trigger re-runs CI.
Adding any label re-runs the whole workflow, because the new run cancels the
one in progress. The bot prefix list lives in `scripts/ci-run-policy.mjs`,
and `__tests__/ci-run-policy.test.ts` ties it to `validateBranchName()`.

## CI-02: targeted device coverage gates pull requests to `main`

Before this change, `device-gate` was `post-merge-device-smoke`: it ran only
on the `push` to `main` after a squash-merge, so a device-engine regression
(a pixel-diff drift or a touch-only interaction bug) could land on `main`
before anything caught it, the PR's own `heavy-gate` run only exercised
`chromium`. `device-gate` now runs on the pull request itself, alongside
`heavy-gate`, so both the full-suite `chromium` run and the targeted
`Tablet Safari` / `Mobile Safari` / `Mobile Chrome` run of `visual.spec.ts`
and `touch-controls.spec.ts` gate the merge. Nothing now re-runs that
targeted suite a second time on the post-merge push, the reduced-scope
split from #733/#775 (one four-device matrix run per merge, not per push and
per PR) is unchanged, just relocated to before the merge instead of after.

`main`-push confirmation stays deliberately bounded to `changes`,
`static-gate`, `unit-gate`, `unit-coverage`, `mutation-gate` and
`security-gate`, a safety net for a direct push that bypasses PR review.
The non-gating `cache-warm` job also runs on `main` pushes.
Branch protection is available for this public repository, but its current
dashboard configuration has not been verified; #732 tracks that human check.
The bounded push jobs are not a repeat of the build/Playwright work the merged
PR already did. The full
four-device matrix remains a one-click `workflow_dispatch` job
(`cross-device-matrix`); nothing here changes when or how often that runs
automatically (it doesn't).

### Required check contract for branch protection (#732)

`.github/workflows/ci.yml` exposes one job whose sole purpose is to be the
required status check: **`Merge Gate (Required Checks Summary)`** (the
`merge-gate` job's `name:`). Require exactly that check for `main` under
Settings → Branches → branch protection → "Require status checks to pass
before merging". The current rules remain unverified because the connected
GitHub API integration cannot read branch-protection settings; #732 tracks
dashboard verification. The retired `dev` → `main` consolidation PR (#1029) was gated on the
same `main` rule.

This replaces the two check names #732 originally listed
(`Rigor Ecosystem (Logic, Visual, Performance)` and
`Security Gate (Vulnerability Audit)`), the first no longer exists under
that name since #775 split it, and #1767 split it further. Requiring the
individual job names directly does not work correctly here: the browser
gates carry `if:` conditions (pull requests only, and only when the run
policy allows them), and GitHub's required-status-checks rule treats a
job skipped by its own `if:` (or skipped as a side effect of a failed
`needs:` predecessor) the same as a job that never applied, a "skipped"
conclusion satisfies the requirement instead of blocking it. `merge-gate`
runs with `if: always()` specifically to stay unaffected by that, then
inspects `needs.<job>.result` for every job that should have run for the
current event and fails unless each one is literally `"success"`, so a
cancelled Playwright shard, a failed `static-gate`, or an unexpectedly
skipped `device-gate` cannot produce a passing `merge-gate`, and requiring
that one check is sufficient. The one skip it accepts is a browser gate on a
pull request that `changes` itself classified, successfully, as docs-only;
if `changes` failed or was skipped, every gate is required. A matrix job
(`unit-gate`, `heavy-gate`) reports success only when every shard did.

`security-gate` remains unconditional (no `if:`), so its `"Security Gate
(Vulnerability Audit)"` check name is safe to require directly as well if the
repo owner wants defense-in-depth beyond `merge-gate` alone, but `merge-gate`
failing already implies `security-gate` failed or was skipped, so it is not
required for correctness.

### CI-03: manual (`workflow_dispatch`) and unrecognized triggers now fail closed

`merge-gate` originally carried `if: always() && github.event_name !=
'workflow_dispatch'` at the job level. That exclusion made the *entire job*
skip on a manual dispatch. Understanding why this matters requires examining
how GitHub evaluates required status checks on pull requests versus head commits,
as documented in official GitHub guidance on
[Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks):

1. **Test-merge versus head check evaluation**: When a pull request triggers a
   workflow via `pull_request`, GitHub creates a temporary test merge commit
   (`refs/pull/<number>/merge`). GitHub displays "Showing checks for the merge
   commit" in the pull request status checks box, and the checks associated with
   that test merge commit determine whether the PR can be merged. GitHub only
   falls back to evaluating checks reported on the head commit SHA if no checks
   exist for the test merge commit. A check run reported on the head commit does
   not unconditionally overwrite or replace an existing test-merge check run.
2. **Evaluated event scopes**: GitHub evaluates workflow jobs for pull request
   status checks only when triggered by specific events: `push`, `pull_request`,
   `pull_request_review`, `pull_request_target`, `deployment`, or `deployment_status`.
   Checks created by `workflow_dispatch` do not appear in the pull request's
   status checks section and cannot satisfy a required status check in a branch ruleset.
3. **The genuine skip-is-a-pass hazard**: If `merge-gate` were skipped via `if:`,
   GitHub would report its conclusion as "skipped". In any evaluation context
   where checks are assessed against a commit directly (such as direct branch pushes
   or head-check fallback when merge checks are absent), GitHub's required-status-checks
   rule treats "skipped" as satisfied rather than blocking. That could allow an
   unsupported trigger to post a passing conclusion without validating requirements.

To eliminate this gap, `merge-gate` runs unconditionally (`if: always()`, no
event exclusion), and its shell script dispatches explicitly on `github.event_name`:

- `pull_request`: requires `changes`, `static-gate`, `security-gate`,
  `unit-gate`, `unit-coverage` and `mutation-gate`, plus every browser gate
  (`build`, `heavy-gate`, `bench-gate`, `heavy-gate-report`,
  `device-gate`) unless the change is docs-only. It fails on a draft and on
  a bot PR without the `ci:full` label.
- `push`: requires `changes`, `static-gate`, `unit-gate`, `unit-coverage`,
  `mutation-gate` and `security-gate` (the bounded main-push confirmation,
  since PR review already validated the browser gates).
- `*` (default): any other event: `workflow_dispatch` included, and any future
  trigger this workflow does not yet have, hits an explicit default branch that
  fails the job outright (`echo "::error::..."; fail=1`).

A manual or unrecognized trigger can therefore never produce a "skipped" conclusion
(satisfied by default) or an accidental "success" for this required check name.

### Implementation evidence, server settings, and runtime measurements

The private-repository minutes outage described in older revisions ended as a
current constraint when the repository became public on 2026-09-23. This
section records the historical outage separately from controls that still
need verification:

- **Local implementation evidence**: Workflow YAML topology, step dependencies
  (`needs:`), and the literal bash evaluation logic of `merge-gate` are verified
  locally by offline unit and shell execution test suites
  (`__tests__/ci-execution-policy.test.ts` and `__tests__/ci-gate-ordering.test.ts`).
  These tests extract the exact bash script from `.github/workflows/ci.yml` and
  execute it across simulated event and status permutations (`pull_request`,
  `push`, `workflow_dispatch`, `success`, `failure`, `cancelled`, `skipped`).
- **Server-side protection is available but unverified**: GitHub currently
  reports this repository as public. The connected API integration returned
  `403` when asked to read branch-protection settings, so #732 tracks manual
  confirmation. Client-side guardrails remain defense-in-depth. Since
  [ADR 0049](../../adr/0049-deploy-main-on-green-ci.md), no GitHub workflow or
  environment deploys. During the manual hold, an operator starts Production from
  the Vercel Dashboard after CI passes ([ADR 0051](../../adr/0051-manual-production-releases.md)).
  Keep the hold until a replacement release policy is approved and verified.
- **Runtime measurements**: The `timeout-minutes` values (`changes` 5,
  `static-gate` 20, `unit-gate` 20 per shard, `unit-coverage` 10,
  `mutation-gate` 20, `security-gate` 15, `build` 25, `heavy-gate` 30 per
  shard, `bench-gate` 20, `heavy-gate-report` 15, `device-gate` 25,
  `merge-gate` 5, `cache-warm` 30) remain upper bounds, not measured runtimes.
  The #1767 baseline (run 37025796528) took about 33 minutes to Merge Gate. Review successful GitHub run
  durations before tightening them; standard public-runner minutes are free,
  while larger runners and artifact/cache storage have separate billing.
- **Historical outage**: The private-repository allowance was exhausted in
  September 2026. On 2026-09-22, the then-current `main`, PR #886, and scheduled
  synthetic-probe runs failed with zero executed steps. The repository became
  public on 2026-09-23, so this is no longer a reason to stop or defer GitHub
  Actions runs. Check current run results after each release update; Vercel
  preview availability is tracked separately.

## Refresh this page

After checking workflow runner labels, run durations, artifact/cache usage, or
after further restructuring
`.github/workflows/ci.yml`, update this page's "Last verified" line and the
list above, then run:

```bash
npm run lint:docs
```
