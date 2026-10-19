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

- **The session owns the game.** It holds the engine state, the loop, timers,
  saves, scoring, trophies, an action map and the touch tuning, and exposes
  state plus `dispatch(intent)` and events. It never reads the viewport, the
  pointer type or `usePhone()`.
- **A view only lays out and draws.** It reads session state and dispatches
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

### Form factor

The view is chosen by space first, then by pointer.

| View    | Rule                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------- |
| Phone   | The cabinet's short side is 500 px or less, or its width is under 744 px, whatever the pointer |
| Tablet  | Not phone, and the primary pointer is coarse                                                   |
| Desktop | Not phone, and the primary pointer is fine                                                     |

- The view is decided at Launch, and again whenever the cabinet crosses a
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
- One pure classifier, `classifyFormFactor()` in `lib/arcade/form-factor.ts`,
  makes the choice. `PHONE_QUERY` stays only for the CSS-first gate and the hub
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
  Android emulated at 4x CPU throttle.
- **19. Fair to the finger.** Where touch is slower or less precise, the
  session's tuning keeps the challenge equal, and every run records which
  view and input played it.
- **20. Fun.** A fresh phone playtest on the arcade rubric scores 9/10 or better
  at 320x568, 375x667, 393x852 and 430x932 plus one landscape size, with no
  blockers or should-fix findings, then a check on a real iPhone and a real
  Android phone.

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

### Rollout

1. The shared foundation (epic #2351): this ADR, the game registry, the form
   factor classifier, the view contract, input actions and the pause service,
   then the phone kit and test harness.
2. The pilot, Retro Labyrinth.
3. One game at a time after that. A game is playable, fun and solid on a phone
   before its gate comes off and before the next game starts.

Each game leaves `DesktopOnlyGate` in its own phone pull request, never several
at once. ADR 0048 retires with the last game, and the legacy pieces
(`ControlDocks.tsx`, `VirtualGamepad`, the per-game auto-pause modules and the
unused engine subclasses) are removed in
[#2373](https://github.com/fderuiter/deruiter.dev/issues/2373) after that.

## Consequences

- Each game's large component splits along a seam it already has, state versus
  presentation. Tests can target one view at a time, and DX Doctor can enforce
  that views do not import each other or read the device.
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
