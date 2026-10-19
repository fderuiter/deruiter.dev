---
name: run-portfolio
description: Build, run, and drive the deruiter.dev Next.js site (fderuiter/deruiter.dev). Use when asked to start the site or dev server, take a screenshot of a page (home, /crf, /proof, an arcade game, phone or tablet views), play or click through an arcade game, or check a UI change in the real app rather than tests.
---

Next.js 16 (App Router, Turbopack) web app. The agent path is: start
`next dev` in the background, then drive headless Chromium with the REPL
at `.claude/skills/run-portfolio/driver.mjs` (`chromium-cli` is not
installed in these containers, so the driver stands in for it). Pipe it
a command script for one-shot runs, or wrap it in tmux to drive it
interactively.

All paths are relative to the repo root.

## Prerequisites

Node >=22 and npm >=10 (Node 22.22 verified). Chromium is pre-installed
under `$PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers`); don't run
`npx playwright install`. `tmux` and `lsof` are already present.

## Setup

In a cloud container with no `node_modules`, the session-start hook
installs them (`CLAUDE_CODE_REMOTE=true .claude/hooks/session-start.sh`,
which runs `npm ci` and `prisma generate`). Then:

```bash
cp .env.example .env.local   # dummy Postgres/Redis values are fine for rendering
```

## Run (agent path)

Start the dev server and poll until it serves. The **first** request
compiles the home route and takes ~30s, so give the poll 120s:

```bash
(npx next dev > /tmp/next-dev.log 2>&1 &)
timeout 120 bash -c 'until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done'
```

### One-shot: pipe a script (preferred)

The driver runs commands strictly in order and exits when stdin closes.
This is the verified Retro Labyrinth flow (launch the cabinet, move,
fire a tool):

```bash
node .claude/skills/run-portfolio/driver.mjs <<'EOF'
launch
nav /arcade/retro-labyrinth
click-text Launch Cabinet
wait-for canvas
sleep 2500
click canvas
press ArrowDown
press ArrowDown
press 1
sleep 800
screenshot labyrinth-moved
console --errors
EOF
```

Phone/tablet views need a touch context, not just a resize:

```bash
node .claude/skills/run-portfolio/driver.mjs <<'EOF'
launch phone
nav /arcade/retro-labyrinth
sleep 3000
screenshot labyrinth-phone-gate
text main
EOF
```

Screenshots land in `/tmp/shots/` (`SCREENSHOT_DIR` overrides). Open the
PNG with the Read tool and look at it before trusting it.

### Interactive: tmux

```bash
tmux new-session -d -s app -x 200 -y 50
tmux send-keys -t app "cd $(pwd) && node .claude/skills/run-portfolio/driver.mjs" Enter
timeout 15 bash -c 'until tmux capture-pane -t app -p | grep -q "driver>"; do sleep 0.3; done'
for c in launch 'nav /' 'wait-for text=complicated things usable' 'sleep 2000' 'screenshot home'; do tmux send-keys -t app "$c" Enter; done
timeout 90 bash -c 'until tmux capture-pane -t app -p | grep -q "screenshot:"; do sleep 0.5; done'
tmux capture-pane -t app -p -S -200 | grep '^driver> '
```

Typed-ahead commands echo out of order in the pane, but results print
in order; filter on lines starting `driver>` to read them. Quit with
`tmux send-keys -t app quit Enter`.

### Driver commands

| command                                             | what it does                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `launch [desktop\|phone\|tablet]`                   | desktop 1280x800; phone = iPhone 13, tablet = iPad Pro 11 landscape (touch) |
| `nav <path-or-url>`                                 | navigate; bare paths resolve against `PORTFOLIO_BASE_URL` (default :3000)   |
| `viewport <w>x<h>`                                  | resize the current page (layout checks; does not change pointer type)       |
| `wait-for <css>` / `wait-for text=<text>`           | wait up to 15s; prints `found:` or `TIMEOUT:`                               |
| `sleep <ms>`                                        | pause (animations, game ticks)                                              |
| `screenshot [name] [--full]`                        | `--full` captures the whole scrollable page                                 |
| `click <css>` / `click-text <text>` / `tap <css>`   | click, click first element containing text, touch tap                       |
| `fill <css> <text>` / `type <text>` / `press <key>` | form and keyboard input                                                     |
| `eval <js>` / `text [css]`                          | evaluate in page (JSON) / print `innerText`                                 |
| `console --errors`                                  | console and page errors captured since `launch`                             |
| `quit`                                              | close browser and exit                                                      |

### Stop

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill -9
pkill -9 -f "[n]ext-server"; pkill -9 -f "node_modules/.bin/[n]ext dev"
```

The `[n]` brackets matter: see Gotchas.

## Run (human path)

`npm run dev` (Turbopack plus a `tsc --watch`), open
http://localhost:3000, Ctrl-C. Useless headless.

## Test

```bash
npx vitest run
```

The full suite takes several minutes. For a change, run the related
files: `npx vitest run __tests__/<name>.test.tsx`.

## Gotchas

- **Stop commands can kill your own shell.** `pkill -f "next-server"`
  matches the `bash -c` command line that contains the string, so the
  tool call dies with exit 1 and no output (it still kills the server).
  Write the pattern as `[n]ext-server` so the regex matches the process
  but not its own text.
- **`next dev` is two processes.** A supervisor plus a `next-server
(v16.x)` child bound to :3000. Kill both, or the next `next dev`
  reports "Another next dev server is already running" and moves to
  :3001 while curl on :3000 still hits the old one.
- **Arcade phone gate is CSS `pointer:coarse`**
  (`components/arcade/DesktopOnlyGate.tsx`). `viewport 375x812` on a
  desktop context still shows the game; use `launch phone` to see the
  "needs a bigger screen" gate.
- **Games need the cabinet launched.** Every `/arcade/*` page shows a
  `PlayCabinet` poster first; `click-text Launch Cabinet`, then
  `wait-for canvas`. Click the canvas before `press` so it has focus.
- **`wait-for` on text matches before hydration.** Server HTML carries
  headings and breadcrumbs, so add `sleep 2000` before a screenshot
  (the home hero card fades in after the headline). An earlier driver
  ran piped commands concurrently and screenshotted loading skeletons;
  it now queues them.
- **The dev "N Issue" badge is hidden by the driver** (it injects CSS
  for `nextjs-portal`). Set `SHOW_DEV_OVERLAY=1` to keep it when you
  want to read the error it reports.
- **Expected console/server noise without real credentials:**
  `prisma:error connect ECONNREFUSED 127.0.0.1:443` in the dev log,
  `GET /api/telemetry 500`, the dev-only React `eval()` CSP message,
  a Vercel Analytics integrity block, and a 404 script fetch. None of
  them stop pages or games from rendering.
- **Each route compiles on first visit.** In `next dev` the first hit
  on a route takes 3-30s, so a `tap`/`click` that navigates can report
  OK while `location.pathname` still shows the old page. `sleep 8000`
  (or `wait-for` something on the target page) after the first visit.
- **Selectors often match hidden copies first.** The arcade hub renders
  each game link several times (mobile and desktop variants); a plain
  `a[href="/arcade/meme-vault"]` picks a hidden one and times out. Add
  Playwright's `:visible`, e.g. `tap a[href="/arcade/meme-vault"]:visible`.
- **`launch tablet` screenshots are 2x DPR.** `screenshot --full` of
  `/arcade` on the tablet preset is 2388x24616 px; prefer viewport
  screenshots there.
- **Chromium revision mismatch.** A bare `chromium.launch()` can fail
  with "Executable doesn't exist"; the driver falls back to
  `$PLAYWRIGHT_BROWSERS_PATH/chromium` (same as
  `lib/dx/browser-launch.ts`). Keep the fallback if you edit it.

## Not verified here

`npm run build` / `npm start` (production build fails closed without a
reachable database, per `lib/build-integrity.ts`), Clerk-protected
routes, and DB-backed writes (contact form, admin).
