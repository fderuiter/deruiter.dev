---
name: run-portfolio
description: Build, run, and drive the fderuiter/portfolio Next.js web app. Use when asked to start the portfolio site, run the dev server, take a screenshot of a page (home, /patrol, /crf, /proof, arcade games, etc.), or interact with its UI.
---

This is a Next.js 16 (App Router, Turbopack) web app. For agent/automated
use, start the dev server and drive a headless Chromium page against it
via the REPL at `.claude/skills/run-portfolio/driver.mjs` (a hand-rolled
stand-in for `chromium-cli`, which isn't installed in this environment).

All paths below are relative to the repo root.

## Prerequisites

Node >=22 and npm >=10 (already satisfied if `node -v` / `npm -v` meet
that — no extra runtime install needed). Chromium is expected
pre-installed under `$PLAYWRIGHT_BROWSERS_PATH`; no `apt-get` or
`npx playwright install` required — see Gotchas if a browser launch
fails.

## Setup

```bash
npm ci --no-audit --no-fund   # installs deps; postinstall runs `npx prisma generate`
cp .env.example .env.local    # dummy local Postgres/Redis values are fine — see Gotchas
```

No database, Redis, or Clerk credentials are required to render the
routes covered below — every server env var in `lib/env.ts` is
`.optional()`, and pages that touch the DB fail closed rather than
crashing the request.

## Build

No separate build step for the agent path — `next dev` compiles routes
on demand. (`npm run build` / `npm run start`, the production path, was
not exercised by this skill — see "What wasn't verified" below.)

## Run (agent path)

Start the dev server in the background, waiting for it to actually
serve (don't `sleep 5` — poll):

```bash
npx next dev > /tmp/next-dev.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/ >/dev/null; do sleep 1; done'
```

Then drive it with the REPL, wrapped in tmux so you can send one
command at a time and read the output back:

```bash
tmux new-session -d -s app -x 200 -y 50
tmux send-keys -t app 'cd $(pwd) && node .claude/skills/run-portfolio/driver.mjs' Enter
timeout 15 bash -c 'until tmux capture-pane -t app -p | grep -q "driver>"; do sleep 0.3; done'

tmux send-keys -t app 'launch' Enter
timeout 20 bash -c 'until tmux capture-pane -t app -p | grep -q "launched\."; do sleep 0.3; done'

tmux send-keys -t app 'nav /' Enter
tmux send-keys -t app 'wait-for text=Frederick' Enter
tmux send-keys -t app 'screenshot 01-home' Enter
timeout 15 bash -c 'until tmux capture-pane -t app -p | grep -q "screenshot:"; do sleep 0.3; done'
tmux capture-pane -t app -p
```

Screenshots land in `/tmp/shots/` (override with `SCREENSHOT_DIR`). The
driver defaults to `http://localhost:3000` (override with
`PORTFOLIO_BASE_URL`); `nav <path>` accepts either a bare path (`/patrol`)
or a full URL.

To stop: `tmux send-keys -t app quit Enter`, then kill the dev server.
A plain `lsof -ti:3000 | xargs kill` is **not reliable** here — Next 16's
dev server is a supervisor (`next dev`) plus a separate `next-server`
child actually bound to the port, and killing only the port's listener
can leave the child alive (or vice versa). Kill both by name instead:

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill -9
pkill -9 -f "next-server"
pkill -9 -f "node_modules/.bin/next dev"
```

These patterns are specific enough not to match the agent's own shell
commands (unlike a broad `pkill -f "next"` or `pkill -f "next dev"`,
which risks matching your own command line — avoid those).

### Driver commands

| command                       | what it does                                              |
| ----------------------------- | --------------------------------------------------------- |
| `launch`                      | launch headless Chromium, open a page                     |
| `nav <path-or-url>`           | navigate; bare paths resolve against `PORTFOLIO_BASE_URL` |
| `wait-for <css-selector>`     | wait for a selector (15s timeout)                         |
| `wait-for text=<text>`        | wait for text to appear anywhere on the page              |
| `screenshot [name]`           | screenshot -> `/tmp/shots/<name or ss-<ts>>.png`          |
| `click <css-selector>`        | click via selector                                        |
| `click-text <text>`           | click the first button/link containing text               |
| `fill <css-selector> <text>`  | fill a form field                                         |
| `type <text>` / `press <key>` | keyboard input                                            |
| `eval <js>`                   | evaluate expression in the page, print JSON               |
| `text [css-selector]`         | print `innerText` (whole page if no selector)             |
| `console --errors`            | print console/page errors captured since `launch`         |
| `quit`                        | close the browser                                         |

## Run (human path)

```bash
npm run dev   # next dev --turbo + a concurrent tsc --noEmit watcher; open http://localhost:3000
```

Ctrl-C to stop. Useless headless — this is what the driver replaces.

## Test

```bash
npx vitest run
```

363 files / 3247 tests pass as of this writing (a couple minutes; most
of that is JSDOM environment setup across the suite, not slow tests).

## Gotchas

- **`app/layout.tsx` used to 500 on every route.** It called
  `next/dynamic(..., { ssr: false })` directly at module scope in a
  Server Component (no `"use client"`), which Next.js 16 flatly
  rejects at compile time: `ssr: false is not allowed with next/dynamic
in Server Components`. This is now fixed — the dynamic import moved
  into `components/RetroChaosOverlayWrapper.tsx` (a `"use client"`
  wrapper, mirroring the existing `SearchWrapper.tsx` pattern) — but if
  you ever see this exact error again after touching `app/layout.tsx`,
  that's the shape of the fix: put `dynamic(..., { ssr: false })` in a
  small client-component file, import the wrapper from the layout.
- **`next dev` is two processes, not one.** A supervisor (`next dev`)
  spawns a separate `next-server (vX.Y.Z)` child that's the one actually
  bound to port 3000. Killing just the port's listener via
  `lsof -ti:3000 | xargs kill` can leave the other half running — I hit
  this directly: the supervisor exited, but `next-server` kept serving
  requests on 3000 for several minutes after. Use the two-`pkill`
  sequence in "Run (agent path)" above, not a single kill.
- **Stale dev-server lock after an incomplete kill.** If a `next-server`
  process from a previous run is still alive (see above), the next
  `next dev` you launch will print "Another next dev server is already
  running" naming that PID and fall back to port 3001 instead of 3000 —
  confusing if you're not watching for it, since curl against 3000 will
  still succeed (against the _old_ server). `rm -rf .next/dev` clears
  Next's own lock state, but only kill the _process_ actually fixes it.
- **`chromium.launch()` fails with "Executable doesn't exist" in this
  environment.** The pre-installed Chromium here is an older cached
  build under `$PLAYWRIGHT_BROWSERS_PATH/chromium` (a stable,
  unversioned path), not the exact revision this repo's
  `@playwright/test` pins. The driver already retries against that path
  automatically (same logic as `lib/dx/browser-launch.ts`'s
  `launchChromiumWithFallback`) — you shouldn't need to do anything,
  but if you rewrite the driver, keep the fallback.
- **Benign console noise, don't chase it:** a 404 fetching a script
  (dev-mode service-worker registration attempt) and
  `ERR_TUNNEL_CONNECTION_FAILED` (Vercel Analytics / Speed Insights /
  Sentry beacons trying to reach the outside world through a proxy the
  headless browser isn't configured to use) show up on every route.
  Neither blocks rendering or interaction.
- **`.env.local` with the dummy `.env.example` Postgres URL is enough**
  for the routes this skill exercises (`/`, `/patrol`) — no local
  Postgres, Redis, or Clerk keys needed. DB-backed routes (case
  studies, admin, contact form) weren't exercised here and may behave
  differently; see the schema in `lib/env.ts` (everything server-side
  is `.optional()`) before assuming a route needs real credentials.
- **`PatrolShiftContainer` (and other studio routes) render a loading
  skeleton first.** `wait-for text=<breadcrumb label>` matches
  immediately (the static shell has it), well before the real UI has
  hydrated. Wait for a `data-testid` on the actual container instead,
  e.g. `wait-for [data-testid="patrol-shift-container"]`.

## What wasn't verified

- `npm run build` / `npm run start` (the production path CI's
  Playwright e2e suite actually runs against) — not exercised by this
  skill. If you need it, try it the same way: poll `curl`, don't
  `sleep`, and expect the DB/Redis caveats above to matter more (ISR
  pages may hit Prisma at build time).
- Any route behind Clerk auth, or any DB-backed route (case studies,
  `/admin`, the contact form's Resend integration).
