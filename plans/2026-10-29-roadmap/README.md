# Roadmap and project board, 2026-10-29

Thread: "Build the roadmap and project board for all tickets". Mode: REGROUP (organization and planning only; no product code).

Companion file: [open-issues.csv](open-issues.csv) lists all 335 open issues with type, priority, area, workflow labels, milestone, and dates. Use it to backfill project 19.

## 1. Snapshot

- 335 open issues at first pull, 0 open pull requests (see section 8 for the refresh to 380).
- Portfolio #3172 has 6 native sub-issues, the six initiatives. The initiatives hold 35 native sub-issues between them (#3173 2, #3174 2, #3175 7, #3176 12, #3177 10, #3183 2). The rest are standalone or parented only by text.
- Every open issue has exactly one `type:*` label or is a structural issue, and one `p1` to `p4` label, as the taxonomy requires.
- Gaps to fix:
  - 100 open issues have no `area:*` label (45 features, 21 chores, 8 bugs, 11 epics and others).
  - 15 issues are `needs-triage` (#3531 to #3545, the study-data work from the clinical-AI thread). They wait on decision #3527.
  - Milestone "2026-10-28 — CRF Studio AI Agent beta" still sits on #2680 and #2681. The AI beta is paused (see the 10-23 decision in the strategic reset). Retire the milestone.
  - No open container carries a triage label now. The containers the governance thread flagged (#2381, #2382, #3041) are no longer open or no longer labelled.
- The label `ready-for-agent` is on 223 items and `status:blocked` on 108. Most of the blocked items are arcade "desktop, tablet and phone" epics waiting on the arcade three-view foundation (#2351).

## 2. What I could not do from this session

GitHub Projects v2 is GraphQL only. From this Claude Code session:

- `gh project view 19`, `gh project item-list 19` and direct GraphQL calls fail. The proxy answers that GraphQL is not available from sessions, and `gh` reports "unknown owner type".
- The GitHub MCP tools here have no Projects operations.
- So I could not read project 19, set its fields or views, or add items to it. Project 19 is not verified to exist on the account.

Everything below in section 4 is a list of steps for Fred to do in the Projects UI. The project itself needs no token.

## 3. Roadmap

Sequence is set by the release train (weekly, Sunday 7 PM Central; next is v1.2.0 on 1 Nov) and by the decisions already made on the threads. Target dates are proposals for Fred to confirm.

| Horizon        | Initiative                                                                                                        | What moves                                                                                                                             | Why now                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Now (to 1 Nov) | Platform and AWS #3176                                                                                            | Neon and Resend hardening #3036; backup recipient before 1 Nov; release and cloud operator steps                                       | v1.2.0 train and backup deadline                   |
| Now (to 1 Nov) | Quality #3177                                                                                                     | Pain-point fixes already filed (CI cancellation, Vercel settings, study-data staleness, Dependabot pins, dirty tree, cloud Playwright) | Keeps the train green                              |
| Now            | Clinical clarity #3173                                                                                            | Epic #3140 (plain-language clinical tools, first-visit "start here")                                                                   | Non-technical visitor is the stated gap            |
| Now            | CRF authoring #3174                                                                                               | Epic #3141 (CRF Studio clutter and action labels); decision on header menus and Next button                                            | Fred's user tests on #2681 are the gate            |
| Next (Nov)     | Study data and standards #3175                                                                                    | Study-data readiness and mapping evaluation (#3528, #3529); CORE findings epic #2992                                                   | Clinical v2 gate #2707 depends on it               |
| Next (Nov)     | Clinical clarity #3173                                                                                            | Trial Data Pipeline Simulator #3164 (rename, session seam under #2462)                                                                 | Retargeted from Protocol Drift                     |
| Later          | Arcade and quality #3177                                                                                          | Three-view epics (#2350 foundation, then #2375 pilot, then the blocked game epics); sort epic #3149                                    | Blocked on foundation; phone rules moved to #3521  |
| Later          | Site content #3183                                                                                                | Case-study template #3530; writing series                                                                                              | Waits on the clinical-AI decision                  |
| Next           | Clinical expertise applied to systems and AI #3559 (seventh initiative)                                           | Issues #3523 to #3530 and study-data tasks #3531 to #3561                                                                              | Decision #3527 is closed; placement is under #3559 |
| Parked         | Clinical v2 gate #2707; AWS always-free epic #2974 (decide by 2027-04-15); win ratio #3101; Protocol Studio #3071 | None until the gates clear                                                                                                             | Recorded parking decisions                         |

Themes for the portfolio #3172: the platform proves clinical domain work end to end (study data, CRF authoring, governed release), and every visible tool explains itself to a non-technical reader.

## 4. Steps for Fred in the Projects UI (project 19)

Labels remain the authority for type, priority, area and triage (see `docs/how-to/issue-governance.md`). Board fields are for planning only, so nothing is kept in two places at once.

Fields to add:

1. Initiative: single select. Options: Portfolio, Clinical clarity, CRF authoring, Study data, Platform, Arcade and quality, Site content, Clinical expertise applied to systems and AI (#3559).
2. Target date: date field. Use it for the Roadmap view.
3. Start date: date field, for the Roadmap view.
4. Release: single select. Options: v1.2.0 (1 Nov), v1.3.0 (to be set), Later.
5. Status: keep the built-in field. Options Backlog, Ready, In progress, In review, Done.

Views to create:

- Roadmap: layout Roadmap, start date and target date, grouped by Initiative, with a marker for each release date.
- Board: layout Board, grouped by Status.
- Table by initiative: all open items grouped by Initiative, sorted by Target date.
- Release v1.2.0: table filtered to Release = v1.2.0.
- Needs triage: table filtered to `label:needs-triage` or with no Initiative set.
- Blocked: table filtered to `label:status:blocked`.

Built-in workflows (no token, no Actions):

- Auto-add: add an item-type filter for issues, `repo:fderuiter/deruiter.dev is:issue is:open`, and a second filter for pull requests, `repo:fderuiter/deruiter.dev is:pr is:open`.
- Item added to project: set Status to Backlog.
- Item closed: set Status to Done.
- Pull request merged: set Status to Done.
- Note from the GitHub documentation: auto-add only picks up new or updated items. It does not backfill. Existing items must be added once. Use `open-issues.csv` to check the count after you add them (expected 335).

Backfill: adding 335 items is a bulk action. Per the team's rules, Fred confirms before it runs. Recommended: add them from the project's "Add item" search with `repo:fderuiter/deruiter.dev is:open`, in batches, and check the count.

Why no Actions workflow for the board: a workflow that writes to a user-owned project needs a personal token with the project scope. The built-in workflows cover the cases above. Add one only if they cannot express a rule the team needs.

## 5. Decisions for Fred (with recommendations)

1. Set up project 19 from section 4. Recommendation: yes, now. The steps are reversible and need no token. This is your action because the session cannot reach the project.
2. Backfill the 335 open issues into project 19. Recommendation: after step 1, in batches, then confirm the count against the CSV. Bulk action, so your go-ahead is needed first.
3. Retire the milestone "CRF Studio AI Agent beta". Recommendation: yes. The beta is paused and the milestone is dated 28 Oct.
4. Triage the 15 study-data issues #3531 to #3545. Decision #3527 is closed and initiative #3559 exists, so these can be placed under it. The tasks still need an Agent Review Brief before they are ready-for-agent.
5. Target dates. Recommendation: set Target dates at month level (1 Nov, 30 Nov, Q1 2027) for the initiatives only. Issue-level dates would go stale quickly with 335 open items.

## 6. Ownership

- The standing thread "Keep GitHub issues organized and triaged" owns labels, hierarchy, priorities and the ledger. Bulk edits to issues go through it first.
- This roadmap owns sequencing, the Initiative and Release fields, and this document.

## 7. Sources

- Repository governance: `docs/how-to/issue-governance.md`.
- Taxonomy and ledger: `plans/2026-10-28-issue-governance/`, in project files.
- GitHub documentation on built-in project workflows: auto-add filters, default Done workflows, and no backfill of existing items (docs.github.com, "Using the built-in automations").
- GitHub documentation on roadmap layout: start and target date fields, and iteration fields for week-by-week work ("Customizing the roadmap layout" and "Best practices for projects").

## 8. Refresh, later on 2026-10-29

The first snapshot above is at 15:08 UTC. A second pull at about 15:25 UTC changed the numbers. The CSV is refreshed to match.

- Open issues: 380 (was 335). No open pull requests. Nothing closed since the first pull.
- 45 new issues, #3546 to #3598, mostly from the clinical-AI, CRF usability, content and neuro-mesh threads. #3559 is the seventh initiative (clinical expertise applied to systems and AI); its 7 children are open.
- Native sub-issue links: portfolio #3172 has 7 children; #3176 platform now has 17 (13 open); #3177 arcade and quality has 12. The other initiatives are unchanged.
- Triage states now: ready-for-agent 228, ready-for-human 74, needs-info 18, needs-triage 0, needs-decision 2 (#3584 and #3597).
- Board fields: Initiative options now include #3559.

Findings for the governance thread (it owns these fixes; this roadmap does not edit issues):

1. Eight issues were `ready-for-agent` with no Agent Review Brief: #3072, #3074, #3075, #3076, #3078, #3080, #3145, #3146. The governance thread reports they were containers, and it removed the label. [Edit: resolved by the governance thread.]
2. 82 issues carry both `ready-for-agent` and `status:blocked`. This is contested. The governance thread reads the approved taxonomy as allowing both: a blocked issue keeps its triage state and gains `status:blocked`. It holds any edit for Fred's decision card, so this plan does not assume a change.
3. #3589 (container rule in the governance how-to) is still open and is its own change. This roadmap PR does not touch the triage section.
4. Milestone "CRF Studio AI Agent beta" still sits on #2680 and #2681 (see Decision 3).

Still waiting on Fred: the go to push `dx/roadmap-2026-10-29` and open the draft PR; the go for the 380-item backfill to project 19; the board steps in section 4.
