#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs dependencies and generates the Prisma client so a fresh cloud
# container can run `npm test`, `npm run quality` and the git hooks.
# See docs/how-to/set-up-claude-cloud-sessions.md.
set -euo pipefail

# Local sessions manage their own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# `npm ci` only when node_modules is missing or stale against the lockfile,
# so resumed sessions skip the reinstall. `npm ci` never rewrites
# package-lock.json, which keeps the docs-drift and lockfile checks clean.
# postinstall runs `prisma generate`; prepare installs the husky git hooks.
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npx prisma generate
fi

# The container preinstalls Chromium under /opt/pw-browsers, usually at an
# older revision than the pinned Playwright expects, and the download CDN is
# blocked. Link the newest preinstalled build into a scratch browsers
# directory under the revision names Playwright looks for, so
# `npm run audit:a11y` and `npx playwright test` can launch it. Nothing is
# downloaded; if no preinstalled build exists, warn and carry on.
PW_SCRATCH=""
link_playwright_browsers() {
  local src="/opt/pw-browsers" manifest="node_modules/playwright-core/browsers.json"
  [ -d "$src" ] && [ -f "$manifest" ] || return 0
  local scratch="${TMPDIR:-/tmp}/pw-browsers-linked"
  mkdir -p "$scratch"
  local entry
  for entry in "$src"/*; do
    [ -e "$scratch/$(basename "$entry")" ] || ln -s "$entry" "$scratch/$(basename "$entry")"
  done
  local name revision dir have
  while read -r name revision; do
    dir="${name//-/_}-$revision"
    [ -e "$scratch/$dir" ] && continue
    have=$(ls -d "$src/${name//-/_}"-[0-9]* 2>/dev/null | sort -t- -k2 -n | tail -1 || true)
    if [ -z "$have" ]; then
      echo "session-start: no preinstalled $name build for Playwright revision $revision" >&2
      continue
    fi
    ln -s "$have" "$scratch/$dir"
  done < <(node -e '
    const m = require(process.argv[1]);
    for (const b of m.browsers)
      if (b.name === "chromium" || b.name === "chromium-headless-shell")
        console.log(b.name, b.revision);
  ' "$PWD/$manifest")
  PW_SCRATCH="$scratch"
}
link_playwright_browsers || echo "session-start: could not link Playwright browsers" >&2

# Tests must never reach a real database or provider. lib/env.ts skips
# .env files under Vitest, and the container has no production secrets.
# Playwright uses the preinstalled Chromium through the linked directory
# above, so nothing is downloaded here.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1'
    echo 'export NEXT_TELEMETRY_DISABLED=1'
    if [ -n "$PW_SCRATCH" ]; then
      echo "export PLAYWRIGHT_BROWSERS_PATH=$PW_SCRATCH"
    fi
  } >> "$CLAUDE_ENV_FILE"
fi
