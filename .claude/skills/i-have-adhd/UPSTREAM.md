# Upstream

`SKILL.md` and `LICENSE` in this folder are copied byte for byte from
[ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)
(`skills/i-have-adhd/SKILL.md` and the root `LICENSE`).

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Source  | https://github.com/ayghri/i-have-adhd      |
| Commit  | `1ecea1993b7fce257ffbd686c070948b5e07eda6` |
| License | MIT, Copyright (c) 2026 Ayoub Ghriss       |
| Copied  | 2026-10-27 (#3041)                         |

The skill is agent configuration, not application source, so the
repository's Apache-2.0 `LICENSE` and `NOTICE` don't cover it. Its own MIT
licence travels with it in this folder.

## What it is for here

It shapes an agent's replies to the person it is working with: next action
first, numbered steps, state restated each turn, concrete time estimates,
no preamble or sign-off. It is off until someone types `/i-have-adhd`
(`disable-model-invocation: true`) and stays on until "stop adhd mode".

It is not a style for site copy. Blog posts, case studies and page text
follow `humanizer` and `site-prose`; numbered imperative steps and a
five-item list cap would make them worse.

## What was left out, and why

- The plugin's `SessionStart` hooks (`hooks/always-on.*`). They inject the
  skill into every session when a flag file exists in the user's own
  Claude config directory. Turning it on for everyone belongs to each
  person's machine, not to this repository's `.claude/settings.json`.
- The Gemini, Qwen, Kimi, Cursor and OpenCode manifests, the translated
  READMEs and the evals. Claude Code reads only `SKILL.md`.

## Where it meets this repository's rules

- AGENTS.md, CLAUDE.md and the session's system prompt outrank it. The
  skill says so itself (its "A rule fights the harness" exception).
- Its five-item list cap is about presentation only. Epic checklists,
  merge-lane rows and CI result tables stay complete.
- Its "restate state every turn" rule is met by a progress checklist when
  the harness has one; don't repeat the plan in prose as well.
- Its bans on preamble, recaps and pleasantries match humanizer §22.

## Rules for this folder

- Don't edit `SKILL.md` or `LICENSE` here.
  `__tests__/agent-skills-vendored.test.ts` holds their SHA-256 and fails
  if either changes without this table changing too.
- Prettier and markdownlint skip `SKILL.md` (`.prettierignore`,
  `.markdownlintignore`) so the copy stays identical to upstream.

## Updating

1. `git clone https://github.com/ayghri/i-have-adhd && git -C i-have-adhd log -1`
2. Read the diff of `skills/i-have-adhd/SKILL.md` as reference material
   and check it still only shapes replies.
3. Copy `skills/i-have-adhd/SKILL.md` and `LICENSE` over the files here.
4. Update the commit and date above and the hashes in the test
   (`sha256sum .claude/skills/i-have-adhd/SKILL.md .claude/skills/i-have-adhd/LICENSE`).
