# Prompt: configure GitHub Projects board 19 for fderuiter/deruiter.dev

Paste everything below the line into an agent that has authenticated GitHub Projects access (for example, a Claude Code session on your machine with `gh` logged in with the `project` scope).

---

You are configuring GitHub Projects board 19 on the account `fderuiter` for the repository `fderuiter/deruiter.dev`. Work in small, verified steps. Stop and report at any step that fails. Do not improvise beyond this spec.

## 0. Context and rules

- The repository is a personal portfolio site. Its issue governance is in `docs/how-to/issue-governance.md`. Read it first, then `plans/2026-10-29-roadmap/README.md` and `plans/2026-10-29-roadmap/open-issues.csv` (380 open issues at 2026-10-29 15:25 UTC; re-count before you start).
- Labels are the authority for type, priority, area and triage. The board mirrors planning fields. Never set a board field that duplicates a label.
- Hierarchy: portfolio #3172 > initiatives #3173 (clinical clarity), #3174 (CRF authoring), #3175 (study data and standards), #3176 (platform and AWS), #3177 (arcade and quality), #3183 (site content and writing), #3559 (clinical expertise applied to systems and AI) > epics > tasks. Parents are native sub-issues, not text references. Read children with `gh api repos/fderuiter/deruiter.dev/issues/<n>/sub_issues`.
- Containers (type:portfolio, type:initiative, type:epic) take no triage label. Their children carry ready-for-agent, ready-for-human or needs-info.
- Never write any AI model name in issues, labels, comments, board fields, workflows, docs or commit messages. Describe work as "split into smaller, self-contained tasks".
- Bulk operations are sequential: one batch at a time, verify each batch, then continue. Never run parallel writers over the same items.
- Dry run first. Nothing is written to the board until the dry-run report has been checked.
- Do not change issue labels or states. Issue hygiene belongs to the organising thread. You change only project 19: its fields, views, workflows and items.

## 1. Verify access

1. `gh auth status` must show the `project` scope. If it does not, stop and tell the user to run `gh auth refresh -s project`.
2. Find board 19: `gh project view 19 --owner fderuiter --format json`. Record its node ID and field IDs with `gh project field-list 19 --owner fderuiter --format json`.
3. Record the current fields and views. Do not delete anything that already exists. Flag any existing field or view that conflicts with this spec, and ask before changing it.

## 2. Fields

Create these fields if they are missing. Keep the built-in `Status` field as it is.

| Field       | Type          | Options or format                                                                                                                                                                  | Source                                        |
| ----------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Initiative  | Single select | Portfolio; Clinical clarity; CRF authoring; Study data and standards; Platform and AWS; Arcade and quality; Site content and writing; Clinical expertise applied to systems and AI | Native parent: the item's ancestor initiative |
| Release     | Single select | v1.2.0 (1 Nov 2026); v1.3.0; Later                                                                                                                                                 | Set by hand from the roadmap, see section 4   |
| Start date  | Date          |                                                                                                                                                                                    | Set by hand, initiatives only                 |
| Target date | Date          |                                                                                                                                                                                    | Set by hand, initiatives only, at month level |

Status options must be exactly: Backlog, Ready, In progress, In review, Done.

## 3. Views

Create these views. Name them exactly.

1. **Roadmap**: layout Roadmap; start date `Start date`, target date `Target date`; group by Initiative; show markers for Release dates.
2. **Board**: layout Board; group by Status.
3. **By initiative**: layout Table; group by Initiative; sort by Target date ascending.
4. **Release v1.2.0**: layout Table; filter `Release:v1.2.0`.
5. **Needs triage**: layout Table; filter `label:needs-info` plus items with no Initiative set.
6. **Blocked**: layout Table; filter `label:status:blocked`.

## 4. Built-in workflows (turn on in the project UI or with the CLI, check each)

- Auto-add to project: issues, filter `repo:fderuiter/deruiter.dev is:issue is:open`.
- Auto-add to project: pull requests, filter `repo:fderuiter/deruiter.dev is:pr is:open`.
- Item added to project: set Status to Backlog.
- Item closed: set Status to Done.
- Pull request merged: set Status to Done.
- Read the final list of enabled workflows back and report it. If any built-in workflow is unavailable through the CLI, give the user the exact UI path instead.

Built-in workflows do not backfill existing items. Section 5 covers that.

## 5. Backfill the open items (only after the user says "go")

1. Dry run. List every open issue in the repository with `gh issue list --repo fderuiter/deruiter.dev --state open --limit 500 --json number,title,labels`. Count them. Write the list to a scratch file outside the repository and report the count. It should match 380, or the current total.
2. For each open issue, add it to the project with `gh project item-add 19 --owner fderuiter --url https://github.com/fderuiter/deruiter.dev/issues/<n>`.
3. Set Status: Done for issues that are closed (none expected), otherwise Backlog. Set Status to Ready for issues with ready-for-agent or ready-for-human, and to In progress for status:in-progress.
4. Set Initiative by walking up the native parent chain to the initiative. Items with no initiative ancestor keep the field empty; list them in the report for the organising thread. Do not guess from titles.
5. Do not set Start date, Target date or Release on issues. Those are set by hand for initiatives in the Roadmap view, and by the user for release scheduling.
6. Process in batches of about 25. After each batch, run `gh project item-list 19 --owner fderuiter --limit 500 --format json` and confirm the count matches the batch. Only then start the next batch.
7. At the end, confirm the item count equals the open issue count. Report any difference.

## 6. Automation (a maintainable workflow, added as a draft PR)

Built-in workflows come first. Add a GitHub Actions workflow only for rules that they cannot express. Known gap: when `status:blocked` is added or removed, set Status to Blocked, or clear it. If the project has no Blocked status, do not create one. Instead, leave this rule out and report it.

If you add a workflow, follow these rules:

- Branch: `dx/roadmap-2026-10-29`, from the repository's main branch. Never push to main.
- File: `.github/workflows/project-board-sync.yml`.
- Triggers: `issues` (opened, edited, labeled, unlabeled, closed, reopened) and `workflow_dispatch` for a manual full sync.
- Permissions: `contents: read` at the top. Set `timeout-minutes` on every job. Use `concurrency` keyed to the issue number.
- Dry run by default: a repository variable `PROJECT_SYNC_APPLY` must be set to `true` before any write. Until then, log the change it would make and exit 0.
- The token is a secret named `PROJECT_BOARD_TOKEN`, a classic personal token with the `project` scope. Never print it.
- Pass issue numbers and labels to shell steps through `env:`. Never interpolate issue titles or bodies into `run:` blocks.
- Idempotent: running it twice makes no second change.
- Any comment the workflow posts ends with `_Generated by [Claude Code](https://claude.ai/code)_`. Prefer no comments.
- Add a test or a dry-run check that proves the workflow file is valid YAML. Run `npx --no-install actionlint` if it is available. If it is not, say so.

Open a draft pull request. Its body starts with the attribution block the repository asks for, and it lists which decisions the user must make before applying.

## 7. Verify

- Read the board back. Confirm the fields, the six views and the workflows match sections 2 to 4.
- Confirm the item count matches the open issue count.
- Check the Initiative field against the sub-issue links for at least five items per initiative.
- Run `npm run check-docs-drift` if you changed any repository docs. Stop if it reports drift.

## 8. Report

Finish with one report, in this order:

1. What you configured: fields, views, workflows, each with a checked status.
2. Counts: open issues, items on the board, items with an initiative, items without one.
3. Anything you could not do, with the exact manual step for the user.
4. The draft PR link, if one was opened.
5. Decisions the user must make before the workflow is applied.
6. Anything you changed that was not in this spec, and why.

Do not claim a step is complete unless you read it back.
