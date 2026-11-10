# How-To: Synchronize Issues with GitHub CLI

Goal: keep the local tracer-bullet tickets in `.scratch/issues/` in step with GitHub Issues, using `scripts/sync-issues.ts` and the `gh` CLI, as ADR 0025 describes.

---

## 1. Context & Architecture

Per [ADR 0025](../../adr/0025-dual-tracker-issue-slicing-and-github-sync.md), coding agents work best from small, self-contained tracer-bullet tickets in the local workspace (`.scratch/issues/`). People still need GitHub Issues to see the work, track it and link it from PRs, with milestones and dependency references.

The **Dual-Tracker Issue Slicing Pattern** keeps both:
1. **Local Tracer-Bullet Specification (`.scratch/issues/`)**: one standalone markdown file per ticket (`0001-<slug>.md`, `0548-<slug>.md`).
2. **Automated GitHub CLI Synchronization**: a script with no dependencies that calls the GitHub CLI (`gh issue list`, `gh issue create`, `gh issue edit`) to create or update GitHub Issues.
3. **Execution Boundary**: agents work from the local ticket files with `/implement` and clear their context between tickets. Commits and PRs cite both the ticket ID and the GitHub issue number.

---

## 2. Authoring a Local Issue Ticket

Create a markdown file under `.scratch/issues/` (e.g. `.scratch/issues/0850-feat-analytics-v2.md`):

```markdown
# feat(analytics): Add Real-Time Engagement Telemetry

- Status: OPEN
- Blocked By: #713
- Labels: area:dx, type:feature, ready-for-agent
- Milestone: Sprint 14

## Context & Seam
Target files: `lib/telemetry.ts`, `app/api/telemetry/route.ts`.

## Red-Green TDD Plan
1. Failing test asserting event batching.
2. Implement ring buffer flush handler.

## Verification Gates
`npm run quality` and `npm test`
```

### Supported Metadata Headers

- `Status`: `OPEN` | `IN_PROGRESS` | `DONE` (or `CLOSED`).
- `Blocked By`: comma-separated list of issue numbers e.g. `#713, #748`.
- `Labels`: comma-separated triage labels (e.g. `area:dx`, `type:feature`, `ready-for-agent`).
- `Milestone`: target milestone string.

---

## 3. Running Synchronization

### Dry-Run Preview

To see what would change, without network calls or writes:

```bash
npm run dx issues:sync -- --dry-run
# or directly
npx tsx scripts/sync-issues.ts --dry-run
```

### Executing Live Synchronization

Ensure you are authenticated with GitHub CLI (`gh auth status`), then run:

```bash
npm run dx issues:sync
```

The script will:
- Parse all markdown specifications in `.scratch/issues/*.md`.
- Match existing issues by number (from the filename prefix like `0548-*.md`) or title.
- Update missing labels and close completed tickets (`Status: DONE`).
- Create new GitHub issues for unmapped specifications and print the assigned issue URL.

---

## 4. Verification

After synchronization, verify the issue status remotely:

```bash
gh issue list --state open --limit 20
```
