# Upstream

This skill is deruiter.dev's own version of
[blader/humanizer](https://github.com/blader/humanizer). We rewrote it for
this site: its examples, voice rules, the claims the site never makes, and
where each page's prose lives. It no longer tracks upstream.

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| Source       | https://github.com/blader/humanizer        |
| Adapted from | `8c307f367c91bd974002f10f2be2965d642c13df` |
| Version      | 3.1.0                                      |
| License      | MIT, Copyright (c) 2025 Siqi Chen          |
| Adapted      | 2026-10-27 (#3041)                         |

The MIT licence asks that its notice travel with substantial portions of
the work, so `LICENSE` here is the upstream text, unchanged. The skill is
agent configuration, not application source, so the repository's
Apache-2.0 `LICENSE` and `NOTICE` don't cover it.

`__tests__/humanizer-skill-attribution.test.ts` fails if the licence or this
credit goes missing.

## Taking something new from upstream

1. Read the upstream `CHANGELOG.md` and the `SKILL.md` diff since the
   commit above.
2. Copy over what helps, rewritten in this skill's style with this site's
   examples.
3. Update the commit, version and date above.
