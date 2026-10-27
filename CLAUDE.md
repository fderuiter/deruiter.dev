@AGENTS.md

## Cloud sessions

In a Claude Code cloud container with no `node_modules`, run `.claude/hooks/session-start.sh` with `CLAUDE_CODE_REMOTE=true` before any npm command. Project threads and multi-repository sessions do not run repository hooks. See `docs/how-to/set-up-claude-cloud-sessions.md`.

## Agent skills

### Issue tracker

GitHub Issues is primary, managed via `gh`; `.scratch/issues/` files are local companions. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo using root `CONTEXT.md` and relevant ADRs in root `adr/`. See `docs/agents/domain.md`.

### Writing

Edit prose with the `humanizer` skill (vendored, pinned in `.claude/skills/humanizer/UPSTREAM.md`) and then the `site-prose` skill for this site's voice and claim rules. `/i-have-adhd` (vendored, opt-in) shapes replies to the person, never site copy. See `docs/agents/writing.md`.
