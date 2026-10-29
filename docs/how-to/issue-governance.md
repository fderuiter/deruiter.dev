# How-To: Govern Issues, Hierarchy and Agent Execution

Goal: know how work is structured, filed, triaged, executed and closed in this repository, so that a person or an agent can pick up any issue without asking for context.

This is the one authoritative governance document. `AGENTS.md` links here and does not repeat it. Label names follow the taxonomy approved on 2026-10-28.

---

## 1. Hierarchy

Work nests in this order:

| Level | Purpose | Native type | Example |
|---|---|---|---|
| Portfolio | Groups several initiatives toward a strategic scope. Not used for routine work. | Task | #3172 |
| Initiative | A significant outcome that spans several epics, with a stated success measure. | Task, label `type:initiative` | #3173 to #3177 |
| Epic | A coherent deliverable made of features or tasks. Has an objective and a checklist. | Task, label `type:epic` | #3140 |
| Feature | A user-visible behavior that one or more tasks deliver. | Feature | |
| Task | One pull request's worth of work. | Task | |
| Sub-issue | A child task attached to a parent through GitHub's native sub-issues. | Task | |
| Checklist | Tick-boxes inside an issue body. Use for steps that do not need their own issue. | none | |

Use the native sub-issue link for parent and child relationships. Do not rely on a text reference alone. Text such as "Part of #N" may be kept as a human hint, but it is not the source of truth.

The roadmap lives on GitHub Projects board 19 (planning fields and views only). Labels stay the authority for type, priority, area and triage, and the board mirrors them rather than replacing them. Ownership of the hierarchy sits with the organizing thread. The board setup and built-in workflows are in `plans/2026-10-29-roadmap/README.md`.

## 2. Issue types and labels

Each issue has exactly one `type:*` label, except structural issues, which take the structural label alone.

- `type:feature`, `type:bug`, `type:chore`, `type:test`, `type:docs`, `type:design`: work items.
- `type:decision`: a question a person must answer before work can start, such as a decision card.
- `type:epic`, `type:initiative`, `type:portfolio`: structure. These take no triage state.

The native GitHub issue type is Task, Bug or Feature. Set it to match the `type:*` label where the native type exists. The `type:*` label is the authority.

Each work item may carry at most one area label, prefixed `area:`: `area:arcade`, `area:study-data`, `area:a11y`, `area:platform`, `area:infra`, `area:quality`, `area:security` or `area:content`. Do not use the retired unprefixed labels `game`, `cdisc` or `accessibility`.

Do not use the plain `epic` or `p1` labels. They are retired in favor of `type:epic` and `p1-critical`.

## 3. Triage states

Every work item has exactly one triage state:

| Label | Meaning |
|---|---|
| `needs-triage` | New. Set by the issue forms. A person or the organizing thread must evaluate it. |
| `needs-info` | Waiting on the reporter or the owner for a missing field. Added by the hygiene check. |
| `ready-for-agent` | Fully specified. An agent can finish it unaided. |
| `ready-for-human` | Needs a person to implement, or a person's hands. |
| `wontfix` | Will not be done. Close with `state_reason: not_planned`. |

Lifecycle: `needs-triage` moves to `needs-info`, `ready-for-agent`, `ready-for-human` or `wontfix`. A claimed item moves to `status:in-progress` before a branch is cut.

Execution state is separate from triage state. `status:blocked` marks an unresolved "Blocked by #N". `status:in-progress` marks a claim. `needs-decision` and `status:on-hold` are set by a person or by a thread that records why. Automation never clears them.

## 4. Definition of Ready

An issue is ready for an agent when all of these hold:

- [ ] The title follows `type(scope): imperative summary`.
- [ ] Exactly one `type:*` label, one priority label, and one triage state (or the structural label alone).
- [ ] A parent is set as a sub-issue, or the issue is marked standalone.
- [ ] Numbered steps name exact file paths and symbols.
- [ ] Acceptance checks are observable results.
- [ ] Verify commands are listed, such as `npm run typecheck`, `npm test`, `npm run quality`.
- [ ] Agent-facing work carries an Agent Review Brief (see `AGENTS.md`, section 6).
- [ ] Blockers are listed as "Blocked by #N" and `status:blocked` is set.

The `Task` form enforces most of this. Older issues may not meet it. The organizing thread rewrites them.

## 5. Agent execution standards

These apply to any agent, human or model, that changes this repository.

1. **One issue, one pull request.** Each PR closes its issue with `Fixes #N` in the body. Do not stack PRs on each other. Cut each branch from `main`.
2. **Draft by default.** Open the PR as a draft. Ready it only when the owner says so. Enable auto-merge only as the owner directs.
3. **Branch names** follow the prefixes in `validateBranchName()` in `lib/dx/git-guard.ts`: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, `perf/`, `dx/`, `test/`. Do not edit the guard to get a branch through.
4. **Verify before push.** Run `npm run quality` and `npm test`. For docs, also run `npm run check-docs-drift`. Do not stage generated output under `docs/reference/api/`.
5. **Hot files take a lane lock.** `ci.yml`, `package.json`, the discovery matrix and `README.md` change one at a time.
6. **Merge only on a finished green run.** An all-cancelled run is not green.
7. **Non-destructive Git.** No `git push --force`, no `git reset --hard`, no direct push to `main`, no branch deletion without the owner's go-ahead.
8. **Read before writing.** Read the issue, the files it names, and the ADRs it cites before changing anything.
9. **Report the gap.** If a step fails or cannot be verified, say so in the PR. Do not claim a change is complete when a check did not run.

## 6. Automation rules

Automation that touches issues follows these rules. The current automation inventory is in the maintenance notes of the plans folder.

- **GitHub-native first.** Prefer issue forms, sub-issues and labels over a script.
- **Idempotent.** A run that repeats must not add a second comment or label. Use a hidden marker comment to detect a previous run.
- **Least privilege.** Set `permissions:` at job level. Grant `issues: write` only where a job writes to issues. Default to `contents: read`.
- **Bounded.** Every job sets `timeout-minutes`. Use `concurrency` keyed to the issue number.
- **Never auto-close and never auto-reopen.** A person closes issues.
- **No priority heuristics.** Automation does not assign `p1` to `p4`.
- **No release holds.** Automation never adds or removes `release:hold`.
- **Issue text is untrusted input.** Pass the issue number to shell steps through `env:`. Never interpolate issue titles or bodies into `run:` blocks.
- **Report first.** A new automation starts in dry-run, which logs what it would do. It applies changes only after its repository variable is set to `true`.
- **Footer.** Every comment the automation posts ends with `_Generated by [Claude Code](https://claude.ai/code)_`.

## 7. Maintenance

Work this section every time you handle an issue.

1. **Classify.** Set type, priority, area and triage state. Check the Definition of Ready.
2. **Organize.** Attach a parent as a sub-issue. Add "Blocked by" where it applies.
3. **Execute.** Follow section 5.
4. **Close.** Close with the right `state_reason`: `completed` when the PR merged, `not_planned` for declined work, `duplicate` with a link to the original. Confirm the parent checklist is ticked.
5. **Record.** When a decision changes an issue's direction, comment with the decision and a link to the record.

Do not close an issue because it is old. Do not move a `needs-decision` or `status:on-hold` item without the person who set it.

## 8. Steps that stay with a person

- Answer decision cards that set labels, priorities or retirements.
- Set repository variables that switch automation from dry-run to apply.
- Ready or merge draft PRs, and enable auto-merge.
- Create or change the GitHub Projects board (project 19), including its fields, views, built-in workflows and the bulk backfill of open issues.
- Revoke or rotate any credential.

## See also

- [`AGENTS.md`](../../AGENTS.md): project rules, including the Agent Review Brief.
- [`docs/agents/issue-tracker.md`](../agents/issue-tracker.md) and [`docs/agents/triage-labels.md`](../agents/triage-labels.md): skill configuration for the issue tracker and triage labels.
- [`docs/how-to/sync-issues-with-github.md`](sync-issues-with-github.md): the local ticket sync.
