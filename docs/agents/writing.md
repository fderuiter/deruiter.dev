# Writing

How agents write in this repository: the prose they edit (blog posts, case
studies, page and game copy, the README, docs, PR bodies and issues) and
the replies they send to the person they work with.

## Skills for prose

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

## Skill for replies

`i-have-adhd` (`.claude/skills/i-have-adhd/SKILL.md`) is vendored unchanged
from [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) under the
MIT License. It shapes an agent's replies: next action first, numbered
steps, state restated each turn, concrete time estimates, no preamble or
sign-off. It stays off until someone types `/i-have-adhd` and stays on
until "stop adhd mode". It never applies to site copy.

Its `UPSTREAM.md` lists what was left out (the always-on hooks belong in
each person's own Claude config) and where it meets this repository's
rules. AGENTS.md, CLAUDE.md and the session's system prompt outrank it.

The two sets fit together: `humanizer` and `site-prose` decide how a
sentence reads, and `i-have-adhd` decides what a reply leads with and how
it is laid out.

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
