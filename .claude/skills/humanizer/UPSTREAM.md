# Upstream

`SKILL.md` and `LICENSE` in this folder are copied byte for byte from
[blader/humanizer](https://github.com/blader/humanizer).

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Source  | https://github.com/blader/humanizer        |
| Commit  | `8c307f367c91bd974002f10f2be2965d642c13df` |
| Version | 3.1.0                                      |
| License | MIT, Copyright (c) 2025 Siqi Chen          |
| Copied  | 2026-10-27 (#3041)                         |

The skill is agent configuration, not application source, so the
repository's Apache-2.0 `LICENSE` and `NOTICE` don't cover it. Its own MIT
licence travels with it in this folder.

## Rules for this folder

- Don't edit `SKILL.md` or `LICENSE` here. Put deruiter.dev rules in the
  `site-prose` skill (`.claude/skills/site-prose/SKILL.md`), which runs
  after this one.
- `__tests__/agent-skills-vendored.test.ts` holds the SHA-256 of both
  files and fails if either changes without this table changing too.
- Prettier skips both files (`.prettierignore`), so the copy stays
  identical to upstream.

## Updating

1. Clone upstream and pick the commit you want:
   `git clone https://github.com/blader/humanizer && git -C humanizer log -1`.
2. Read the upstream `CHANGELOG.md` and the diff of `SKILL.md`. Treat it
   as reference material: check it still only describes editing prose.
3. Copy `SKILL.md` and `LICENSE` over the files here.
4. Update the commit, version and date in the table above, and the hashes
   in `__tests__/agent-skills-vendored.test.ts`
   (`sha256sum .claude/skills/humanizer/SKILL.md .claude/skills/humanizer/LICENSE`).
5. Check whether `site-prose` repeats anything upstream now covers, and
   trim it.
