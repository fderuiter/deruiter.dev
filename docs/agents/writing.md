# Writing

How agents edit prose in this repository: blog posts, case studies, page
and game copy, the README, docs, PR bodies and issues.

## Skills

Use two skills together, in this order:

1. `humanizer` (`.claude/skills/humanizer/SKILL.md`) finds and removes AI
   writing tells. It is vendored unchanged from
   [blader/humanizer](https://github.com/blader/humanizer) under the MIT
   License; `UPSTREAM.md` beside it pins the commit and explains how to
   update it.
2. `site-prose` (`.claude/skills/site-prose/SKILL.md`) adds this site's
   voice, the claims the site never makes, where each surface's prose
   lives, and the tests to run before pushing.

Claude Code loads both from `.claude/skills/` on its own. Other agents can
read the two `SKILL.md` files directly.

## Guards

These tests scan user-facing copy and run in CI:

- `__tests__/peer-narrative-copy.test.ts`: no job-seeking or recruiter
  framing.
- `__tests__/clinical-claims-wording.test.ts`: no compliance claims.
- `__tests__/clinical-standards-profile.test.ts`: standards cited by name,
  not by literal version.
- `__tests__/agent-skills-vendored.test.ts`: each vendored skill matches
  its pinned upstream commit.

## Sweep

Epic #3041 tracks a humanizer pass over each surface of the site, one PR
per surface.
