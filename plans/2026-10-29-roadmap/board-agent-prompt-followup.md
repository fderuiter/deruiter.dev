# Prompt: follow-up for board 19, automation and DRY

Run this after the first prompt (`board-agent-prompt.md`) has finished and its report has been read. It adds automation that keeps board 19 in sync without repeating logic, and it keeps one source of truth for the board's spec. Paste everything below the line.

---

You are extending the board 19 setup for `fderuiter/deruiter.dev` (GitHub Projects, account `fderuiter`). The first pass created the fields, the six views and the built-in workflows, and backfilled the open issues. Your job is to make the board maintain itself with the fewest moving parts. Read `docs/how-to/issue-governance.md`, `plans/2026-10-29-roadmap/README.md` and the first prompt's report before you start. Work in small, verified steps. Stop and report at any failing step.

## 0. Rules

- One source of truth. Labels define type, priority, area and triage. The native sub-issue tree defines Initiative. The board spec (fields, options, views) lives in one file, and every script reads from it. Do not write the same option list or label name in two places.
- Reuse what exists. `.github/workflows/issue-hygiene.yml` and its scripts already read issues and write comments. Extend them or share their helpers. Do not add a second copy of the same logic.
- Idempotent. Any run that repeats makes no second change. Use a hidden marker only where a comment is truly needed.
- Dry run by default. Writes happen only when the repository variable `PROJECT_SYNC_APPLY` is `true`. Set it only when the user says so.
- Least privilege. `permissions: contents: read` at the top. Job-level write scopes only where needed. Use `timeout-minutes` on every job and `concurrency` keyed to the issue number.
- Issue text is untrusted input. Pass numbers, labels and state through `env:`. Never interpolate titles or bodies into `run:`.
- Never write any AI model name in the repository, issues, comments or commits.
- Never change issue labels or states from the sync job. Those belong to the organising thread. The job reports drift and writes only board items and fields.
- Branch `dx/roadmap-2026-10-29`. Draft pull request. Never push to main.

## 1. Build the spec file once

1. Create `plans/2026-10-29-roadmap/board-spec.json` (or `.github/project-board/spec.json` if the workflow must read it at runtime). It lists the project number, the owner, the field names and their options, the Status options, the view names with their layout and filter, and the label-to-Status mapping:
   - `status:in-progress` maps to In progress.
   - `ready-for-agent` and `ready-for-human` map to Ready.
   - Closed issues map to Done.
   - Otherwise Backlog.
2. Verify that the first pass's board matches the spec file. Report any difference and do not fix it silently.

## 2. Automations, in order of preference

Use the smallest mechanism that does the job.

a. Built-in project workflows (already on): auto-add, Status on item added, Status on closed, Status on PR merged. Keep them. They need no token.

b. Scheduled reconcile, one workflow, `.github/workflows/project-board-sync.yml`:

- Triggers: `schedule` once a day, `workflow_dispatch` with an input `mode` set to `dry-run` or `apply`, and `issues` events `opened`, `reopened`, `labeled`, `unlabeled`, `closed` for the Status mapping.
- Job `reconcile`: for each open issue, ensure it is on the board, set Status from the mapping, and set Initiative from the nearest native parent that is an initiative. Use `gh api repos/fderuiter/deruiter.dev/issues/<n>/parent` or walk `sub_issues` upward. Do not guess from titles.
- Job `drift-report`: check and write a step summary (`$GITHUB_STEP_SUMMARY`) with counts of: open issues not on the board, items with no Initiative, containers carrying a triage label, `ready-for-agent` issues with no "Agent Review Brief" in the body, and items carrying both `ready-for-agent` and `status:blocked`. Report only. Do not post comments.
- Token: secret `PROJECT_BOARD_TOKEN`, a classic personal token with `project` scope. Never print it. Use it only in the step that calls the project API.
- Output: write a short summary to `$GITHUB_STEP_SUMMARY` for every run, dry or applied.

c. Event-level sync for label changes: the `issues` trigger in (b) covers it. Do not add a second workflow for the same event.

Not recommended, and do not build them: a custom board-sync app, a second project, automatic Target date or Release fields from labels (those are planning choices for the user), and automatic issue closure or label edits of any kind.

## 3. Shared logic, not copies

- Put the label-to-Status mapping, the initiative lookup and the drift checks in one script, for example `scripts/project-board/sync.ts`, with the spec read from the JSON file. Call it from the workflow. If `scripts/` already holds similar helpers (check `scripts/` and `.github/scripts/`), reuse them.
- Add a unit test for the mapping and the drift checks, next to the existing tests, with fixtures. A test must fail before the fix and pass after it.
- If the repository has a labels or taxonomy module (check `lib/dx/`), import from it rather than copying label names.

## 4. Verify

- Run the script locally in dry-run against the live project. Attach the counts to the report.
- Run `npm test` for the new test, `npm run typecheck`, `npm run lint:docs` if you changed docs, and `npm run check-docs-drift`. Report results verbatim.
- Validate the workflow YAML with actionlint if it is available. If not, say so.
- Confirm the workflow runs in dry-run on `workflow_dispatch` and writes a step summary, and that no write occurred.

## 5. Pull request

Open a draft pull request from `dx/roadmap-2026-10-29`. Its body starts with the repository's attribution block and then lists:

- what each automation does and what triggers it,
- what the dry run reported,
- the decisions the user must make before setting `PROJECT_SYNC_APPLY` to `true`,
- the exact secret and variable to create, by name only.

## 6. Report

In this order:

1. Automations added, each with its trigger, what it writes, and its dry-run result.
2. Drift counts from the dry run.
3. Test and check results.
4. The draft PR link.
5. Decisions for the user, including whether to add a "Blocked" Status option so `status:blocked` can map to the board.
6. Anything outside this spec, and why.

Do not claim a step is done unless you read it back.
