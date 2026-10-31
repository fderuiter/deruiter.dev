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

Edit prose with the `humanizer` skill (`.claude/skills/humanizer/`), this site's version of blader/humanizer with its voice and claim rules built in. See `docs/agents/writing.md`.

### Skill folders

Canonical skills sit in `.agents/skills/`; five are bridged into `.claude/skills/` with symlinks. See `docs/agents/skill-folders.md`.
