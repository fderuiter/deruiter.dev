# Writing

How agents edit prose in this repository: blog posts, case studies, page
and game copy, the README, docs, PR bodies and issues.

## Skill

Use `humanizer` (`.agents/skills/humanizer/SKILL.md`). It finds and removes
repetitive phrasing, and it carries this site's voice, the claims the site
never makes, where each surface's prose lives, and the tests to run before
pushing. Agents reading `.agents/skills/` discover it there; Claude Code
loads it through the `.claude/skills/humanizer` symlink.

It started as [blader/humanizer](https://github.com/blader/humanizer)
(MIT) and is now ours to edit. `UPSTREAM.md` beside it records the source
commit and how to take later upstream changes by hand.

## Public engineering records

Write issues, pull requests, comments and commit messages around the problem,
the change and the evidence. Use `Review notes` for file paths, constraints
and verification commands in implementation tickets and PRs.

Omit optional generation bylines, model co-author trailers, promotional
footers and development-session or project-thread links. This rule also
applies when a bundled workflow or template asks for an AI disclaimer.
Keep operational HTML markers used for deduplication and automation.

Keep accurate tool names in setup instructions, configuration, integration
work and discussions where the tool is the subject. Keep contributor
credit, source citations, license text and required notices. Do not claim
that work was exclusively human-written or rewrite published commit history.

`.claude/settings.json` disables optional commit and PR attribution and
session links while preserving the existing hooks. Other integrations may
append their own footers after creating a record; check the final GitHub
text, not just the submitted draft. See the
[Claude Code settings reference](https://code.claude.com/docs/en/settings-reference#attribution).

## Guards

These tests run in CI:

- `__tests__/peer-narrative-copy.test.ts`: no job-seeking or recruiter
  framing.
- `__tests__/clinical-claims-wording.test.ts`: no compliance claims.
- `__tests__/clinical-standards-profile.test.ts`: standards cited by name,
  not by literal version.
- `__tests__/humanizer-skill-attribution.test.ts`: the skill keeps its
  upstream licence and credit.

## Sweep

Epic #3041 tracks a humanizer pass over each surface of the site, one PR
per surface.
