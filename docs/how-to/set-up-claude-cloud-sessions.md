# Set Up Claude Code Cloud Sessions

Documentation last reconciled: 2026-09-24.

Claude Code on the web runs each session in a fresh cloud container that
clones this repository with no `node_modules`. This page covers the
repository side (a SessionStart hook) and the claude.ai environment
settings that go with it. Reference:
[Configure cloud environments](https://code.claude.com/docs/en/cloud-environments).

## What the repository provides

`.claude/settings.json` registers `.claude/hooks/session-start.sh` as a
SessionStart hook. In cloud sessions only (`CLAUDE_CODE_REMOTE=true`) it:

- runs `npm ci` when `node_modules` is missing or older than
  `package-lock.json`, which also runs `prisma generate` (postinstall) and
  installs the Husky git hooks (prepare);
- otherwise runs `npx prisma generate` only, so resumed sessions start fast;
- exports `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and
  `NEXT_TELEMETRY_DISABLED=1` for the session.

The hook is synchronous, so the session starts only after dependencies are
installed (about 40 seconds on a cold container). Local sessions skip it.
Repository hooks do not run in project threads or sessions with more than
one repository. There the environment setup script below runs the same
hook, and `CLAUDE.md` tells the agent to run it when `node_modules` is
missing.

## Environment settings

| Field            | Value                                                        |
| :--------------- | :----------------------------------------------------------- |
| Name             | `portfolio`                                                  |
| Network access   | **Trusted** (covers npm, `binaries.prisma.sh`, Google Fonts) |
| Env variables    | none required (see below)                                    |
| Setup script     | recommended; see below                                       |

Tests never need a real database or provider key: `lib/env.ts` skips
`.env` files under Vitest, and every provider has an offline fallback.
Never put production secrets (`DATABASE_URL`, Clerk, Resend, Upstash,
Sentry, `CRON_SECRET`) in a cloud environment: anyone using the
environment can read its variables.

The setup script runs the same hook for every checkout it finds. The
environment cache then keeps the npm cache, so later installs are quick.
It always exits zero, because a failing setup script blocks the session:

```bash
#!/bin/bash
for d in /home/user/*/; do
  if [ -x "$d.claude/hooks/session-start.sh" ]; then
    (cd "$d" && CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR="$d" \
      ./.claude/hooks/session-start.sh) || true
  fi
done
exit 0
```

## Known container limits

- Chromium is preinstalled under `/opt/pw-browsers`, but at an older
  revision than the pinned `@playwright/test`, and the Playwright download
  CDN is not on the Trusted list. `lib/dx/browser-launch.ts` falls back to
  the preinstalled build, so the Mermaid corpus test and
  `npm run bench:pages` work. The Playwright suite (`npx playwright test`)
  does not use that fallback and is left to CI.
- The container cannot reach `deruiter.dev` or the Vercel and Neon
  control planes directly; use the claude.ai connectors instead.
- Branch names must use an allowed prefix (`feat/`, `fix/`, `chore/`,
  `docs/`, `test/`, `dev/`, ...). The harness default `claude/*` is
  rejected by `.husky/pre-push`. Cloud sessions push as `dx/<slug>`
  instead; the guard's error message says so.
- In a `git worktree`, the hooks are silently skipped. `core.hooksPath`
  points at `.husky/_`, which Husky generates in the main checkout only,
  so a new worktree doesn't have it. Link it from the main checkout before
  the first commit, and the worktree runs every hook again. `.gitignore`
  covers the link, so it is never staged:

  ```bash
  ln -sfn "$(git rev-parse --path-format=absolute --git-common-dir)/../.husky/_" .husky/_
  ```
