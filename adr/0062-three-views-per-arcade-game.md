# ADR 0062: Three Dedicated Views per Arcade Game

## Status

Accepted on 2026-10-19, under the umbrella epic
[#2350](https://github.com/fderuiter/deruiter.dev/issues/2350) and its
foundation epic [#2351](https://github.com/fderuiter/deruiter.dev/issues/2351).
Supersedes the 2026-10-13 tablet-first amendment of
[ADR 0061](0061-mobile-first-arcade.md) as the arcade's plan. ADR 0061's kit
(the immersive cabinet, safe areas, orientation prompt, touch primitives,
control hints, auto-pause and the tablet matrix) stands, and so does its phone
bar, which this ADR extends. [ADR 0048](0048-desktop-only-arcade-games-on-touch-devices.md)'s
gate stays in the code until the last game leaves it. Builds on
[ADR 0026](0026-headless-arcade-engine-lifecycle-and-html-hud-standard.md)
(the headless engine and HTML HUD) and keeps
[ADR 0046](0046-trial-and-error-biostat-ops-architecture.md)'s scoped
loud-moment rule.

## Context

Every arcade game has had an iPad pass, and phones are still behind
`DesktopOnlyGate`. The iPad passes made "tablet" a branch rather than a view:
each game's single component, between 3,000 and 6,000 lines, gained
`useCabinetTouch()` conditionals and a scoped `*-touch.css`. A phone layout
added the same way would put a third branch into every one of those
conditionals, and every desktop change would risk both touch layouts.

The code also repeats itself across games. Every game reads raw keys in its own
handler, and the five games that have an action layer each built a different
one. There are eight copies of the same auto-pause module, seven bespoke touch
docks, four ways to size a canvas and seven copies of the high-score store.

The owner asked for a dedicated view for desktop, tablet and phone in every
game, each built to best practice and each fun to play, with the architecture
improved along the way.

## Decision

### Each game is one session with three views

A game is one headless `use<Game>Session()` and three views: `DesktopView`,
`TabletView` and `PhoneView`.

- **The session owns the game.** It holds the engine state, the fixed-step
  loop, timers, saves, scoring, trophies, an action map and the touch tuning.
  It never reads the viewport, the pointer type or `usePhone()`.
- **The session is an external store.** It exposes `getState()`,
  `subscribe()` and `dispatch(intent)`, plus an `onFrame` channel that calls
  the mounted view once per frame to paint. HUD components read slices with
  `useSessionSelector`, so a frame does not re-render React. This matches
  what the canvas games already do with refs.
- **A view only lays out and paints.** It reads session state and dispatches
  intents. Views never import each other and never branch on the device;
  choosing the view is that branch.
- **Shared presentation lives in `components/<game>/parts/`.** HUD atoms, card
  art, canvas painters and dialogs are imported by every view, so only layout
  repeats, never game logic.
- **One view mounts at a time.** Each view is its own dynamic import, so a
  phone never downloads the desktop layout.
- **Views swap live and the session survives.** The session sits above the
  views. Rotating a phone, resizing a Split View pane or narrowing a window
  pauses the game, swaps the view and keeps the run.
- **The session holds no DOM.** A session never holds DOM nodes, canvas
  contexts or WebGL resources. A view creates those on mount and disposes of
  them on unmount, so a swap cannot leak a canvas or a WebGL context. iOS caps
  a page at about 16 live WebGL contexts, and a leaking R3F scene would reach
  that within a few swaps.
- **A view that fails to load is never a dead end.** A swap loads the new
  view's chunk before it unmounts the old view. If the chunk fails, for
  example on a poor phone connection, the old view stays, a short notice says
  so, and the swap is tried again at the next crossing. At Launch there is no
  old view, so an error boundary around the view slot offers Retry, then the
  next larger view (phone falls back to tablet, tablet to desktop). The
  session sits above the boundary, so the run survives. This follows ADR
  0048's "Try it anyway", which never left a player at a dead end.
- **Views load only where a swap is likely.** After Launch, a coarse-pointer
  device prefetches on idle the other views it can reach: an iPad prefetches
  the phone view for Split View, and a phone prefetches nothing, since it
  never leaves the phone view. A fine-pointer desktop prefetches nothing and
  loads a view when it swaps. That keeps the swap pause short without making
  a phone download the desktop layout.
- **One run snapshot.** A view swap, a save when the page hides and Resume all
  use one versioned snapshot per game (`arcade_run_<slug>_v1`: schema,
  `savedAt`, view, tuning and a Zod-parsed state). It is written on pause, on
  `visibilitychange` to hidden and on `pagehide`, never on `beforeunload`. A
  snapshot that fails to parse is discarded with one notice and never throws.
  iOS evicts script storage after seven days of Safari use without a visit, so
  Resume is a convenience, not a promise. The pause service,
  [#2357](https://github.com/fderuiter/deruiter.dev/issues/2357), owns it.

### The boundaries are checked

A `dependency-cruiser` rule in `npm run lint:boundaries` enforces the split,
added with the view contract in
[#2355](https://github.com/fderuiter/deruiter.dev/issues/2355). It has three
parts:

- A `*View.tsx` file never imports a sibling view.
- A `use*Session` module never imports the device hooks in
  `components/arcade/mobile` (`usePhone`, `useTouchDevice`,
  `useInputModality`, `useFormFactor`).
- A file in a game's `parts/` never imports a view.

Each game's three view chunks are also registered with
`lib/dx/bundle-guard.ts`, the phone view with the tightest budget, so the
claim that a phone downloads only its own layout is checked on every build.

### Form factor

The view is chosen by space first, then by pointer.

| View    | Rule                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------- |
| Phone   | The viewport's short side is 500 px or less, or its width is under 744 px, whatever the pointer |
| Tablet  | Not phone, and the primary pointer is coarse                                                    |
| Desktop | Not phone, and the primary pointer is fine                                                      |

- **The viewport is the window's layout viewport**, `innerWidth` by
  `innerHeight`, which is the pane's size in iPad Split View. It is never the
  cabinet's inline box: before Launch a desktop cabinet sits inline in the page
  and can be under 500 px tall, and measuring it would give a desktop visitor
  the phone view. After Launch the immersive cabinet fills the viewport, so the
  two agree where it matters. The visual viewport is not used either, because
  it shrinks under pinch zoom and when the on-screen keyboard opens, and
  neither should swap the view. While a text field has focus the choice is
  frozen, so a keyboard that resizes the layout viewport cannot swap it
  either.
- **Browser zoom is a feature.** A 1440 by 900 desktop at 200% zoom is 720 by
  450 CSS px and gets the phone view. That is the right outcome for WCAG 1.4.10
  reflow, and it is intended.
- The view is decided at Launch, and again whenever the viewport crosses a
  breakpoint. A breakpoint must be crossed by 24 px before the view swaps back,
  so a resize on the line does not flip between views.
- `?view=phone|tablet|desktop` overrides the choice for tests and debugging. A
  player's Layout setting (Auto, Phone, Tablet, Desktop) in the cabinet's Setup
  does the same and is stored per device.
- **Input modality is independent of the view.** Every view accepts keyboard,
  mouse, touch, Pencil and gamepad. `useInputModality` still decides whether
  the on-screen controls show, so an iPad with a keyboard case gets the tablet
  view without its dock, and a narrow desktop window gets the phone view and
  plays with the keyboard.
- One pure classifier, `classifyFormFactor()`, which
  [#2354](https://github.com/fderuiter/deruiter.dev/issues/2354) will add in
  `lib/arcade/form-factor.ts`, makes the choice. `PHONE_QUERY` stays only for the CSS-first gate and the hub
  badges, which must be right before hydration.
- The route page and the attract screen stay responsive pages. Only what
  happens after Launch is a dedicated view.

### Orientation

- A phone view declares `portrait`, `landscape` or `both`. Portrait is
  preferred, because people hold phones upright and one-handed. Landscape is
  for play areas that cannot work upright, such as wide arenas and twin-stick
  play. `both` means two layouts inside the phone view that swap live.
- ADR 0061's rotate prompt stays for single-orientation phone views.
- Tablet views support both orientations.

### The three bars

A game's epic closes only when all three bars hold.

**Desktop** (1024 to 2560 px, fine pointer)

- Behaviour is unchanged unless the game's design says otherwise, checked by
  screenshots at 1024, 1280 and 1440 before and after.
- The game is complete on the keyboard. Key hints, the manual and the cabinet's
  controls list are generated from the action map, so they cannot drift.
- Hover is never the only affordance, and focus is always visible.
- Up to 2560 px the play area letterboxes or grows in whole steps.

**Tablet** (coarse pointer, not phone)

- ADR 0061's tablet bar: both orientations, Pencil as touch, a keyboard case
  hides the controls, 48 px toolbar keys, and the iPad mini to Pro 13 matrix.
- iPad Split View panes narrower than 744 px get the phone view instead of the
  gate.
- The tablet view is extracted from today's touch branches, not redesigned.

**Phone**

ADR 0061's phone bar, items 1 to 12, plus:

- **13. Thumb reach.** In portrait the primary action sits in the bottom 40% of
  the screen. In landscape the thumbs rest on the left and right edges.
- **14. Text floor.** No text under 12 px, body copy at 14 px or more, and no
  information only in a `title=` tooltip or on hover.
- **15. Interruption-safe.** A call, a tab switch or a lock screen pauses the
  game and saves the run, and the next visit offers Resume.
- **16. First minute.** A first-run coach sequence of three steps or fewer
  teaches the touch controls inside real play. It can be skipped and is
  remembered.
- **17. Sessions.** A complete, satisfying loop fits in two to five minutes, and
  longer runs save at natural breaks.
- **18. Performance.** 60 fps, or 30 fps steady for heavy 3D, on a mid-range
  Android emulated at 4x CPU throttle. It is measured with a Playwright CDP
  trace at 393 by 852 under `Emulation.setCPUThrottlingRate` at 4, recording
  the median and p95 frame time.
- **19. Fair to the finger.** Where touch is slower or less precise, the
  session's tuning keeps the challenge equal, and every run records which
  view and input played it. The view and input ride on the existing run-end
  telemetry event as two fields, with no new event and no per-frame writes,
  so they stay inside the Upstash daily command allowance
  ([ADR 0036](0036-free-tier-offloading-and-provider-quota-governance.md)).
  Sentry gets the same facts as the tags `arcade.game`, `arcade.view` and
  `arcade.input`, set at Launch.
- **20. Fun.** A fresh phone playtest on the
  [arcade playtest rubric](../docs/explanation/arcade-playtest-rubric.md) scores 9/10 or better
  at 320x568, 375x667, 393x852 and 430x932 plus one landscape size, with no
  blockers or should-fix findings, then a check on a real iPhone and a real
  Android phone following the
  [real-device check](../docs/how-to/run-an-arcade-real-device-check.md).
  The rubric's view-specific checks list what the phone, tablet and desktop
  views are each scored on.

### Fun guidelines for phones

- **Thumb-first verbs.** Tap, hold, drag and swipe; a d-pad is the last resort.
  Drag-and-drop becomes tap-to-pick, tap-to-place.
- **One focus at a time.** The stage and one thing; the rest goes in a bottom
  sheet, and opening one pauses real-time play.
- **Haptics as juice**, through the device setting, and brief scoped effects
  under ADR 0046's rule, never continuous particle loops.
- **Legible at arm's length.** Big numbers, few words, labelled icons.
- **Short loops and honest stops.**
- **No fat-finger punishment.** Confirm destructive taps, undo where the game
  allows it, and make hit areas larger than the art.

### Device services

The pause service also holds a screen wake lock while a real-time run plays,
and routes WebGL context loss through `lib/webgl/context-manager.ts`. The
phone view hides the Fullscreen control on iPhone, which has no element
fullscreen; the installed app already runs standalone.

### Rollout

1. The shared foundation (epic #2351): this ADR, the game registry, the form
   factor classifier, the view contract, input actions and the pause service,
   then the phone kit and test harness.
2. The pilot, Retro Labyrinth.
   Before each game's seam is extracted, seeded action streams and their final
   engine state are recorded, and the seam change must reproduce them exactly.
   The test harness, [#2365](https://github.com/fderuiter/deruiter.dev/issues/2365),
   records them, and it runs the touched games' phone and tablet specs on every
   pull request, not only in the on-demand device matrix.
3. One game at a time after that. A game is playable, fun and solid on a phone
   before its gate comes off and before the next game starts. Between the two
   a game can be in `preview`: the gate stays up, but `?view=phone` passes it,
   so the real-device check can happen on production before the gate comes
   off.

Each game leaves `DesktopOnlyGate` in its own phone pull request, never several
at once. ADR 0048 retires with the last game, and the legacy pieces
(`ControlDocks.tsx`, `VirtualGamepad`, the per-game auto-pause modules and the
unused engine subclasses) are removed in
[#2373](https://github.com/fderuiter/deruiter.dev/issues/2373) after that.

## Consequences

- Each game's large component splits along a seam it already has, state versus
  presentation. Tests can target one view at a time, and `lint:boundaries`
  enforces that views do not import each other and sessions do not read the
  device.
- Some layout markup repeats across a game's three views. Shared `parts/` keep
  that small, and game logic never repeats.
- The arcade gets one input layer, one pause service, one high-score store and
  one set of phone primitives, replacing the per-game copies as each game
  adopts them.
- A phone gets a phone layout and downloads only that layout's code.
- iPad Split View stops showing the gate as soon as a game ships its phone
  view.
- Until a game ships its phone view, its gate and its tablet branch stay as
  they are, so no game regresses while the rollout is in progress.

What gets harder:

- Every game-design change now needs a decision about each of three layouts,
  and the three have to be kept in step.
- The screenshot and end-to-end matrix roughly triples, which costs CI minutes
  ([ADR 0039](0039-github-pro-plan-capabilities-and-actions-minutes-governance.md)).
- The foundation and each game's seam extraction cost more up front than a
  third responsive branch would. That cost is paid once per game, and in
  return a phone change cannot regress desktop.

## Alternatives considered

- **A third responsive branch per game.** Cheapest for the first game, and it
  would make every later change in a 4,000-line component touch three layouts
  at once. Rejected.
- **One responsive layout per game with container queries only.** Works for
  page-like games, but a phone and a desktop want different controls,
  different information density and different loops, not the same layout
  resized. Container queries remain the tool inside each view.
- **Choose the view by user agent or pointer alone.** Breaks Split View, narrow
  desktop windows, foldables and touchscreen laptops. Space first, then pointer,
  handles all of them.
- **Ship every game's phone view in one change.** Twelve games in one review,
  with no clear bar and one regression blocking all of them. Rejected, as in
  ADR 0061.

## Action items

The foundation, in build order:

- [#2352](https://github.com/fderuiter/deruiter.dev/issues/2352) this ADR.
- [#2353](https://github.com/fderuiter/deruiter.dev/issues/2353) the game registry.
- [#2354](https://github.com/fderuiter/deruiter.dev/issues/2354) the form factor classifier.
- [#2355](https://github.com/fderuiter/deruiter.dev/issues/2355) the view contract and its boundary rule.
- [#2356](https://github.com/fderuiter/deruiter.dev/issues/2356) input actions.
- [#2357](https://github.com/fderuiter/deruiter.dev/issues/2357) the pause service.
- [#2365](https://github.com/fderuiter/deruiter.dev/issues/2365) the test harness.

Then the Retro Labyrinth pilot,
[#2375](https://github.com/fderuiter/deruiter.dev/issues/2375), each later game
in turn, and the cleanup,
[#2373](https://github.com/fderuiter/deruiter.dev/issues/2373), after the last.
