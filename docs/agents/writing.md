# Writing

How agents edit prose in this repository: blog posts, case studies, page
and game copy, the README, docs, PR bodies and issues.

## Skill

Use `humanizer` (`.claude/skills/humanizer/SKILL.md`). It finds and removes
AI writing tells, and it carries this site's voice, the claims the site
never makes, where each surface's prose lives, and the tests to run before
pushing. Claude Code loads it from `.claude/skills/` on its own; other
agents can read the file directly.

It started as [blader/humanizer](https://github.com/blader/humanizer)
(MIT) and is now ours to edit. `UPSTREAM.md` beside it records the source
commit and how to take later upstream changes by hand.

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
