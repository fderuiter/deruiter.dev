# GitHub to Vercel Release Workflow Audit

Date: 2026-09-12  
Scope: `fderuiter/portfolio`, the linked Vercel `portfolio` project, and the
release controls that connect them  
Method: live read-only GitHub and Vercel inspection, checked-in configuration,
and primary-source platform documentation

> [!NOTE]
> This is historical evidence from 2026-09-12, not the current runbook. The
> `dev` reconciliation, main-only topology, and governed build-once release
> design subsequently landed in ADRs 0037 and 0038. Current provider and
> release status is recorded in the
> [2026-09-22 readiness audit](2026-09-22-release-public-vercel-readiness.md).

## Executive conclusion

The repository should converge on **one protected trunk, `main`**, with
short-lived prefixed branches and pull requests directly into `main`. Vercel's
Production Branch should remain `main`. The long-lived `dev` branch and the
workflow that force-rebases it should be retired after a deliberate one-time
history reconciliation.

This is the smallest workflow that gives every concept one meaning:

| Concept | Canonical object |
| --- | --- |
| Integration branch and releasable source | `main` |
| Production branch in Vercel | `main` |
| Work in progress | `feat/*`, `fix/*`, `chore/*`, `refactor/*`, `docs/*`, `perf/*`, or `dx/*` |
| Change review | Pull request into `main` |
| Pre-merge quality gate | GitHub Actions on the pull request |
| Deploy trigger | Vercel Git integration on the merged `main` commit |
| Release record | GitHub release and `vX.Y.Z` tag created from the verified production commit |
| Emergency recovery | Vercel Instant Rollback, followed by a `fix/*` pull request |

Vercel itself describes this default operating model: a single production
branch, usually `main`; all other Git branches are pre-production branches; and
a merge to the production branch creates a production deployment.
[Vercel: Deploying Git Repositories](https://vercel.com/docs/git)
GitHub likewise documents GitHub flow as a lightweight branch-based workflow
for projects that deploy regularly.
[GitHub: GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)

There is an important commercial constraint. This is currently a **private
repository on GitHub Free**. The live rulesets endpoint returned `403` with an
instruction to upgrade or make the repository public, and all four live
branches reported `protected: false`. GitHub documents branch protection as
available for public repositories on GitHub Free, but for private repositories
only on GitHub Pro, Team, Enterprise Cloud, or Enterprise Server.
[GitHub: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
Therefore, genuinely enforced pull-request and status-check gates require one
of these decisions:

1. Make the repository public, if the contents and history are safe to expose.
2. Upgrade the account to GitHub Pro or another qualifying plan.
3. Keep it private and free, explicitly accepting that local hooks and written
   process are advisory and can be bypassed.

For the requested "best standard," option 1 or 2 is required. This report does
not assume permission to change repository visibility or purchase a plan.

## Observed state

### GitHub repository and branches

Live GitHub inspection on 2026-09-12 found:

- GitHub's default branch is `dev`.
- Vercel's production branch is `main`.
- Remote branches are `main`, `dev`, `feat/case-study-redis-compute-shield`,
  and `claude/python-tooling-audit-plan-h9faaj`.
- No open pull requests exist.
- GitHub's automatic deletion of merged head branches is enabled.
- Squash merging, rebase merging, and merge commits are all enabled; automatic
  merge is disabled.
- All four branches are unprotected.
- The repository contains one release, `v0.1.0`, published on 2026-08-20.

The branch graph is not a clean promotion chain. At audit time,
`git rev-list --left-right --count main...dev` returned `8 74`: `main` has eight
commits absent from `dev`, while `dev` has 74 commits absent from `main`.
The eight `main`-only commits are four changes followed by four reverts. The
branches share merge base `2b5a7724`, after which they developed independently.

The removed workflow named `Auto-Sync & Rebase Dev on Main Push` attempted to
rebase `dev` onto `main` and then force-push with `--force-with-lease`.
The five most recent recorded runs, spanning 2026-08-19 through 2026-08-25,
all failed. The result is consistent with the observed divergence: the
automation neither preserves an auditable merge relationship nor reliably
keeps the branches synchronized.

GitHub warns that force pushes can remove commits on which collaborators based
their work, leading to conflicts or corrupted pull requests. Its rules can
block force pushes and require linear history.
[GitHub: Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
An automation whose normal behavior rewrites a shared long-lived branch is
therefore a poor fit for the desired governance model.

### CI and release gates

> Historical finding: ADR 0049 superseded this release topology on 2026-09-24.
> Vercel’s guarded production build is now the only production migration and
> deployment path. The commands described below are retained only as audit
> evidence and are no longer available or supported.

The main CI workflow runs only for pushes to `main`/`master` and pull requests
targeting `main`/`master`.
[Checked-in CI workflow](../../../.github/workflows/ci.yml)
Because GitHub's default integration branch is `dev`, routine changes merged
into `dev` do not receive this CI workflow. Conversely, a `dev` to `main` pull
request can run CI, but there is no branch protection to require it.

The 20 most recent CI runs returned by GitHub during this audit all concluded
with failure. Those failures span older and newer changes and do not establish
that current code is broken; they do establish that the check is not acting as
an enforced gate. Production pushes and Vercel deployments can proceed despite
a red CI history because `main` is unprotected.

The release gate currently performs a security audit, migration validation,
and `prisma migrate deploy` against the `DATABASE_URL` supplied to that job.
[Superseding deployment decision](../../../adr/0049-deploy-main-on-green-ci.md)
In CI, that URL points to the disposable PostgreSQL service. This validates the
migration chain but does not deploy migrations to the production database.
The Vercel build script validates migrations but deliberately does not run
`migrate deploy`.
[Build script](../../../scripts/build.js)
No checked-in workflow provides a production migration stage. ADR 0001 says
that live migrations belong in a secured pipeline release stage, so the
implementation and the recorded decision are not yet connected end to end.
[ADR 0001](../../../adr/0001-pre-build-database-migrations.md)

### Vercel Git and deployment configuration

The linked Vercel project is `laser-loons-projects/portfolio`, project ID
`prj_A2qcLQkEq53EyMNZSy26kC7z12qY`. It uses Next.js, Node.js 24, repository
root `.`, and `npm run build`. The repository declares `npm ci` as the install
command, while the installed Vercel CLI's project inspection displayed
`npm install`; this should be treated as configuration drift to verify in the
dashboard, with [`vercel.json`](../../../vercel.json) made the reviewed source of
truth.

The emergency setting now builds only the Production environment. This stops
new successful preview function bundles, but Vercel documents that an Ignored
Build Step still creates canceled deployments and those canceled builds still
count toward deployment quotas and concurrent build slots.
[Vercel: Project settings, Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings)

Vercel also offers `git.deploymentEnabled` in `vercel.json` to prevent commits
on selected branches from triggering automatic deployments. It accepts exact
branch names and minimatch patterns, and can disable all automatic deployment.
[Vercel: Git Configuration](https://vercel.com/docs/project-configuration/git-configuration)
This is a better long-term expression of branch deployment policy than a
dashboard-only shell condition, but it should be introduced in a dedicated PR
and verified against a disposable branch before replacing the emergency
setting.

No checked-in GitHub Action calls `vercel deploy`, `vercel --prod`, a Deploy
Hook, `repository_dispatch`, or `deployment_status`. GitHub reports no classic
repository webhooks and no `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or
`VERCEL_PROJECT_ID` Actions secrets. The available evidence therefore points to
the Vercel GitHub App as the sole deployment trigger, which is the correct
single-owner design. The Vercel integration dashboard should still be reviewed
manually because the installed Vercel CLI version did not support integration
listing.

### Deployment volume, retention, and storage

Before cleanup, the live Vercel audit found 324 deployment records, including
100 `READY` deployments, and 28 successful deployments in the preceding 24
hours. Each successful deployment retained approximately 43.4 MB across three
physical function bundles. The route count shown in the Vercel UI was not the
number of independently stored full bundles.

Vercel defines Functions Storage as the retained Vercel Function bundles in
every region where they are deployed. Usage grows with the number of retained
deployments, output size, and retention duration. Vercel records each project's
maximum stored amount for each billing day and sums those daily amounts into
GB-month usage, so deletion does not retroactively erase a day's recorded
maximum.
[Vercel: Deployment Storage](https://vercel.com/docs/deployment-storage)

Retention was already aggressive: one day for canceled deployments, one week
for errored and preview deployments, and one day for production deployments.
Vercel nevertheless protects the latest ten project deployments, latest 20
ready production deployments, latest 20 ready non-production deployments,
aliased deployments, and the latest preview for every active Git branch.
Successfully built deployments also have a 30-day recovery period after being
marked deleted, and reevaluation after a protection exception disappears can
take up to 30 days.
[Vercel: Deployment Retention](https://vercel.com/docs/deployment-retention)

This means branch hygiene and alias hygiene are storage controls, not merely
Git tidiness. GitHub's automatic head-branch deletion is already enabled, which
is useful because Vercel defines a branch as active while it has not been
deleted and its PR has not been merged or closed. GitHub documents automatic
head-branch deletion as a repository setting, subject to branch rules.
[GitHub: Automatically deleting head branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches)

Custom aliases should be limited to the production domain and, only if the
workflow genuinely uses it, one stable staging alias. Vercel retains aliased
deployments and warns that deleting a deployment can break integration links,
including links in Git-provider pull requests.
[Vercel: Managing Deployments](https://vercel.com/docs/deployments/managing-deployments)

### Environments and secrets

GitHub contains `Preview` and `Production` environments, but both have no
protection rules or branch policy. GitHub documents that environment approvals
can withhold environment secrets until a reviewer approves, but required
reviewers and environment secrets for private repositories require a
qualifying paid plan.
[GitHub: Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

GitHub Actions has 15 repository secrets, all database connection components.
The checked-in workflows do not consume them; CI creates and uses a disposable
Postgres service instead. Keeping unused production-grade credentials at
repository scope violates least-privilege intent. GitHub recommends granting
the minimum permissions possible, preferring service identities over personal
credentials, and setting `GITHUB_TOKEN` to read-only contents unless more is
needed.
[GitHub: Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)

Vercel lists 24 environment-variable entries. Database, Neon, and Resend values
are currently scoped to both Production and Preview; Clerk has separate rows
for Production and Preview. Vercel documents that Preview variables can be
global to every non-production branch or scoped to an individual branch, with
branch-specific values taking precedence.
[Vercel: Environment variables](https://vercel.com/docs/environment-variables)
If preview deployment is restored later, preview must use non-production data,
non-delivering email behavior, and least-privilege credentials. A preview must
not be an alternate public entrance to production write credentials. Vercel
deployment URLs are publicly accessible by default unless Deployment
Protection is configured.
[Vercel: Generated deployment URLs](https://vercel.com/docs/deployments/generated-urls)

## Recommended operating model

### Branches and pull requests

Use a main-only GitHub-flow model:

1. `main` is both the GitHub default branch and Vercel Production Branch.
2. Create every change from current `main` using the existing Conventional
   Commit-aligned prefixes: `feat/*`, `fix/*`, `chore/*`, `refactor/*`,
   `docs/*`, `perf/*`, or `dx/*`.
3. Open one focused pull request directly to `main`.
4. Require the PR to be current with `main`, pass CI, resolve conversations,
   and receive review when another reviewer is available.
5. Squash merge using a Conventional Commit PR title. Disable merge commits
   and rebase merging in repository settings so the supported path is
   unambiguous and `main` remains linear.
6. Let GitHub automatically delete the merged head branch.
7. Do not create `release/*` branches for ordinary releases. Use a `fix/*`
   branch from `main` for a hotfix and apply the same PR gate.

GitHub rules can require a pull request, approvals, status checks, resolved
conversations, linear history, and blocked force pushes.
[GitHub: Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
Rulesets and branch protection layer together, with the most restrictive
applicable rule winning; use one mechanism, not overlapping configurations,
unless layering is intentional.
[GitHub: About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

For this solo repository, a merge queue is unnecessary overhead today. It
becomes useful if multiple PRs are routinely ready at once because GitHub's
merge queue retests changes against the latest target and earlier queued PRs.
If enabled later, CI must listen for `merge_group` or required checks will not
report.
[GitHub: Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)

### CI contract

Change `.github/workflows/ci.yml` in the implementation phase so that:

- It runs on `pull_request` targeting `main` and, optionally, on `push` to
  `main` for post-merge evidence. Remove `master` unless it is deliberately
  supported.
- It declares least-privilege permissions, normally `contents: read`.
- It adds workflow-level concurrency keyed by workflow and PR/branch and sets
  `cancel-in-progress: true` for superseded PR commits.
- It does not cancel a production verification already running on `main`.
- Its required job names are stable and unique across workflows. GitHub and
  Vercel both warn that duplicate check names can make required-check results
  ambiguous or cause check races.
  [GitHub: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
  [Vercel: Deployment Checks](https://vercel.com/docs/deployment-checks)
- The required workflow always reports a result. Do not apply a top-level path
  filter to a required workflow because GitHub leaves a required skipped check
  pending. Instead, use an initial change-classification job and make expensive
  downstream work conditional while retaining one always-reported gate.
  [GitHub: Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

GitHub concurrency permits one running and one pending run per group and can
cancel an obsolete in-progress run. This is appropriate for rapid agent pushes
to the same PR and prevents repeatedly completing expensive tests for commits
that can no longer merge.
[GitHub: Concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)

Once branch protection is available, require exactly these two existing job
checks initially:

- `Rigor Ecosystem (Logic, Visual, Performance)`
- `Security Gate (Vulnerability Audit)`

Split the rigor job only if measurement shows that parallel jobs reduce total
cost and time. More jobs are not inherently safer; the enforceable contract is
that every required check is deterministic, uniquely named, and green.

### Vercel build and preview policy

Keep the current **Only build production** setting during storage recovery.
After Functions Storage has returned to a safe steady-state band, choose one of
these explicit modes:

| Mode | When to use | Policy |
| --- | --- | --- |
| Production-only | Default for this solo Hobby project | Automatic deployment only for `main`; no automatic feature previews |
| On-demand preview | UI, auth, integration, or routing change needs deployed review | Create one preview from the release-candidate commit, verify it, then remove the branch/alias after merge |
| Automatic previews | Only after storage remains comfortably below the warning threshold and preview value justifies the cost | Enable for active PR branches, auto-delete branches, and retain the current short preview window |

Do not use both Vercel's Git integration and `vercel deploy` in GitHub Actions
for the same commit. Vercel supports Git, CLI, Deploy Hooks, and REST as
independent deployment methods; enabling two owners creates duplicate build
opportunities.
[Vercel: Deployment overview](https://vercel.com/docs/deployments/overview)

Deploy Hooks are not needed for source-code releases. If a CMS or another
external system later requires one, create only one hook per branch, name its
owner and purpose, store the URL as a secret, and rotate it if exposed. Vercel
states that anyone with the unique hook URL can trigger a deployment and
recommends one hook per branch unless multiple data sources require otherwise.
[Vercel: Deploy Hooks](https://vercel.com/docs/deploy-hooks)

Account or integration webhooks should observe deployments, not trigger a
second deployment unless that loop is intentionally designed and protected by
idempotency. Vercel supports deployment-created, ready/succeeded, promoted,
errored, and canceled events.
[Vercel: Webhooks](https://vercel.com/docs/webhooks)

### Production release and migration sequence

The best end state is build-once, verify, then promote:

1. PR checks validate the proposed `main` result.
2. Merge to `main` creates one Production deployment.
3. Keep automatic production-domain assignment disabled so that deployment is
   **Staged**.
4. Execute the explicitly authorized production migration stage with the
   unpooled migration credential.
5. Verify the staged deployment, including application health, critical API
   paths, and the migration result.
6. Promote that same immutable deployment without rebuilding it.
7. Run a short production smoke probe.
8. Create the GitHub release/tag from that exact `main` SHA.

Vercel documents staged Production deployments as builds created from the
production branch without automatic domain assignment; promotion switches the
domain without rebuilding. It also distinguishes staged, promoted, and current
states.
[Vercel: Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment)

This staged model should not be activated until a real production migration
workflow exists and its failure behavior is tested. Until then, use only
backward-compatible expand/contract migrations and record the human release
step explicitly; the current repository cannot truthfully claim an automated
production migration gate.

Vercel Deployment Checks are an optional later enhancement: they can hold a
production deployment from domain assignment until selected GitHub or native
checks pass. They require careful, unique check naming and should replace—not
duplicate—equivalent release gates.
[Vercel: Deployment Checks](https://vercel.com/docs/deployment-checks)

### Releases and tags

Continue the existing SemVer convention:

- Tag verified production commits as `vMAJOR.MINOR.PATCH`.
- Create the GitHub release only after production verification, so "release"
  means a version that actually served successfully.
- Use generated release notes, then add operational notes for schema changes,
  provider changes, migrations, and rollback constraints.
- Do not make tag pushes a second Vercel deploy trigger. The tag is the audit
  identity for the already deployed commit.
- Protect `v*` tags from deletion or update when GitHub rulesets become
  available.

GitHub releases are based on Git tags that identify a point in repository
history, and GitHub can generate release notes and determine the latest release
using semantic version ordering.
[GitHub: About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
[GitHub: Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

### Rollback policy

Keep the immediately previous known-good Production deployment and its domain
history. On Hobby, Vercel Instant Rollback is limited to the immediately
previous production deployment. Rollback changes routing without a rebuild,
but it does not rebuild with newly changed environment variables and can also
restore the previous deployment's cron configuration.
[Vercel: Instant Rollback](https://vercel.com/docs/instant-rollback)

Incident procedure:

1. Confirm the production regression.
2. Use Instant Rollback to restore the immediately previous deployment.
3. Verify the canonical domain and critical API paths.
4. Open a `fix/*` branch from `main`; do not repair production by leaving
   history detached from source control.
5. Merge through the normal gate and promote the corrected deployment.
6. Confirm automatic domain assignment is restored after undoing rollback,
   because Vercel disables it while a project remains rolled back.

Vercel's official rollback guide uses the same restore-investigate-fix-verify
sequence and documents `vercel rollback`, `vercel inspect`, logs, preview
verification, and promotion.
[Vercel: Roll back a production deployment](https://vercel.com/docs/deployments/rollback-production-deployment)

### Secret and integration policy

1. Inventory Vercel Marketplace/native integrations, Vercel account webhooks,
   Deploy Hooks, GitHub Apps, GitHub classic webhooks, Actions secrets, Vercel
   environment variables, and project domains quarterly and after any incident.
2. Assign one owner and one purpose to every integration. Remove duplicates and
   anything without a current consumer.
3. Delete the 15 GitHub repository database secrets after confirming no
   disabled/manual workflow consumes them. Reintroduce only the one credential
   required by a real production migration job.
4. Set explicit `permissions` in every workflow. Give the sync/release job only
   the write permission it actually requires; ordinary CI should be read-only.
5. Separate Production and Preview credentials. Preview should use isolated or
   read-only data, simulated Resend behavior, and preview-specific Clerk keys.
6. Reduce Vercel's database variables to the canonical pooled runtime URL and
   unpooled migration URL actually consumed by the application. Provider-added
   aliases should remain only if code or tooling reads them.
7. Never copy a long-lived Vercel personal token into GitHub merely to duplicate
   what the Vercel GitHub App already performs. GitHub recommends short-lived,
   narrowly scoped identities and OIDC where a provider supports it.
   [GitHub: OpenID Connect](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers)

## Phased implementation plan

### Phase 0: Stabilize capacity and record the baseline

- Keep Vercel on production-only builds.
- Complete the approved stale deployment cleanup while retaining Current and
  the immediately previous known-good Production deployment.
- Remove unnecessary custom aliases and delete merged/stale remote branches
  after confirming they have no unique commits.
- Record daily Functions Storage, Deployment Storage, build-hours, successful
  deployment count, and `READY` deployment count. Do not expect the GB-month
  meter to fall immediately.
- Upgrade Vercel CLI before making CLI behavior part of a runbook; the installed
  41.6.1 client did not support current integration/webhook commands.

Exit criterion: no automatic feature preview builds, no unexplained deployment
trigger, and storage no longer increasing from successful previews.

### Phase 1: Reconcile source history without rewriting it

- Freeze merges briefly.
- Capture `main`, `dev`, tags, production SHA, and the exact `main...dev` diff.
- Build a one-time reconciliation PR whose target is `main`. Review the net
  tree, not only the 82 divergent commits, because four `main` changes were
  subsequently reverted.
- Run the full local and CI quality suite and deploy one operator-approved
  preview if needed.
- Merge the reconciled result without force-pushing either long-lived branch.
- Confirm the merged `main` tree corresponds to the intended production source.

Exit criterion: all desired code exists on `main`, no desired code exists only
on `dev`, and a production deployment from reconciled `main` is verified.

### Phase 2: Make `main` canonical

- Change GitHub's default branch from `dev` to `main`.
- Keep Vercel's Production Branch as `main`.
- Delete `dev` after confirming its unique work is reconciled.
- Delete the stale `claude/python-tooling-audit-plan-h9faaj` branch only after
  verifying its three commits are intentionally retained elsewhere or no
  longer wanted.
- Remove `.github/workflows/sync-dev-on-main-push.yml`.
- Allow squash merge only and use Conventional Commit PR titles.
- Keep automatic head-branch deletion enabled.

Exit criterion: one trunk, one production branch, no force-rebase automation,
and no unexplained active branch retained by Vercel.

### Phase 3: Establish enforceable gates

- Decide public-versus-GitHub-Pro for branch protection. Do not describe the
  repository as protected until the setting is actually enforceable.
- Protect `main`: require PRs, required CI jobs, conversation resolution,
  linear history, no force pushes, and no deletion. Configure admin bypass as
  emergency-only.
- Add least-privilege permissions and concurrency to CI.
- Run PR CI against `main`; make post-merge checks smaller and purpose-specific.
- Add a pull-request template containing test evidence, migration impact,
  deployment impact, rollback notes, and a Review notes section when applicable.

Exit criterion: a red required check or missing PR cannot update `main`.

### Phase 4: Complete build-once release governance

- Implement and test a production migration workflow matching ADR 0001.
- Stage Production deployments and promote only after migration and verification.
- Trigger a post-promotion synthetic smoke test using a single documented event
  path. Prefer Vercel's `repository_dispatch` integration if GitHub Actions
  needs the deployment URL; Vercel recommends it over legacy
  `deployment_status` flows for this use case.
  [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)
- Tag the verified commit and publish its GitHub release.
- Exercise rollback and recovery in a controlled drill.

Exit criterion: one commit produces one production build, the same artifact is
verified and promoted, the release tag identifies it, and rollback is tested.

### Phase 5: Reintroduce previews only by evidence

- Measure storage and build-hour headroom for at least one complete billing
  window.
- If on-demand previews are sufficient, keep feature auto-deployment disabled.
- If automatic previews are restored, enforce branch deletion, the short
  retention policy, and a budget alarm before usage reaches 80%.
- Audit function bundle composition separately; deployment hygiene controls
  multiplicity, while bundle work controls the cost of each retained build.

Exit criterion: preview policy has a measured budget, owner, and rollback path,
and cannot silently return the project to 96.8% Functions Storage.

## Proposed ADR decision statement

The implementation ADR should record the following decision, after the plan
and visibility choice are approved:

> The portfolio uses `main` as its sole long-lived branch, GitHub default
> branch, integration branch, and Vercel Production Branch. All changes use
> short-lived Conventional Commit-prefixed branches and squash-merged pull
> requests into `main`. The Vercel Git integration is the sole deployment
> creator. Automatic feature preview deployment is disabled by default under
> the Hobby storage budget; high-risk changes receive one operator-requested
> preview. Production is built once, verified as a staged deployment, and
> promoted without rebuilding after any required production migration. GitHub
> releases and immutable `vX.Y.Z` tags identify verified production commits.

The ADR should also explicitly record the GitHub-plan decision. Without public
visibility or a qualifying paid plan, branch protection cannot be represented
as an enforced invariant.

## Immediate implementation backlog

1. Reconcile `dev` and `main` in a dedicated, reviewed release PR.
2. Choose repository visibility/plan so branch protection can be enforced.
3. Change GitHub default to `main`; delete reconciled `dev`; remove force-rebase
   workflow.
4. Update CI triggers, permissions, concurrency, and required job contract.
5. Codify Vercel deployment policy in reviewed configuration and verify that
   only the Git integration creates production deployments.
6. Audit and minimize Vercel/GitHub secrets and environment scopes.
7. Implement the missing production migration and staged-promotion workflow.
8. Add the governing ADR and update operational runbooks after implementation,
   replacing hard-coded deployment IDs and meter snapshots with live evidence.
9. Run an end-to-end release and rollback drill, then publish the next SemVer
   release from the verified production SHA.
