# ADR 0061: Mobile-First Arcade

## Status

Accepted on 2026-10-12. Supersedes [ADR 0048](0048-desktop-only-arcade-games-on-touch-devices.md),
which gated ten games behind a desktop-only notice on phones and portrait
tablets. ADR 0048's gate stays in the code until each game passes the phone bar
below in its own change. Builds on [ADR 0003](0003-mobile-responsive-and-touch-standard.md)
(the touch standard), [ADR 0026](0026-headless-arcade-engine-lifecycle-and-html-hud-standard.md)
(the cabinet lifecycle) and [ADR 0046](0046-trial-and-error-biostat-ops-architecture.md)
(Trial & Error, phone play). The kit this ADR describes is built in the same change.

## Context

ADR 0048 answered a real problem with a blunt tool. Six games were unplayable on
a phone, and it replaced their cabinets with a notice. That was honest, but it
also made the arcade's phone story "not for you", and the notice is now on ten
games. A visitor who opens a shared link on a phone meets a closed door for most
of the arcade.

The games are not beyond saving. Their problems are shared: the play area is a
small window inside a desktop layout, the controls are keyboard hints, and the
cabinet's chrome (marquee, header, footer) takes the space the game needs. The
fix is a shared foundation that each game can adopt on its own schedule, not ten
separate responsive rewrites.

## Decision

Every arcade game plays well on a phone. A game leaves `DesktopOnlyGate` only in
its own mobile pull request, once it meets the phone bar below. No single change
removes the gate from several games at once, and no change is allowed to alter a
desktop cabinet.

### The phone bar

A game is ready for phones when all of these hold, checked on the emulated
devices in the Playwright matrix and on a real iOS Safari and Android device:

1. **Playable start to finish with touch alone.** Launch, play, win or lose,
   restart and leave, with no keyboard step and no hover-only affordance.
2. **The play area is most of the screen** in the game's declared orientation.
   The cabinet's chrome gets the rest.
3. **No horizontal overflow at 320px**, and nothing essential below the fold.
4. **Controls are at least 44px and within thumb reach** for the orientation
   the game declares, with an accessible name for every control.
5. **No accidental page scroll, zoom, text selection or callout menus.** The
   play area takes its touches; the page does not.
6. **Safe areas are respected** (notches, home indicators, rounded corners).
7. **Auto-pause and resume.** The game stops when the tab hides, the page
   closes, the window blurs or the device rotates, and it waits for the player
   to resume.
8. **Reduced motion is respected**, including the cabinet's CRT and screen
   effects, which already stay off under `prefers-reduced-motion`.
9. **Audio waits for a gesture.** Nothing plays before the player taps Launch
   or a control.
10. **Zero axe violations** at Serious or Critical level, and at Moderate level
    under WCAG 2.1 AA, as ADR 0003 requires.
11. **Desktop is unchanged** from 1024px to 1440px, with a fine pointer.
12. **PR screenshots at 320, 375, 768 and 1440 px** are attached to the game's
    mobile pull request, taken with `captureMatrix` in
    `__tests__/e2e/mobile-harness.ts`.

### The kit

The kit lives in `components/arcade/mobile/` with a barrel `index.ts`. PlayCabinet
and the tests import through the barrel. It builds on the existing controls
rather than replacing them. TouchButton, DockFrame and the control-hint helpers
await their first game consumer; they are here so that consumer can adopt them
without a new kit change.

- **Immersive touch cabinet.** On a coarse pointer under 1024px, the cabinet
  goes immersive when it launches and stays immersive until the player exits.
  The device class is latched at Launch, so an iPad that turns across 1024px
  mid-game keeps the layout it started with. The cabinet is fixed to the
  viewport at `h-dvh`, padded by the safe-area insets, with page scroll locked
  and overscroll disabled. It reuses the fullscreen layout and its CSS
  (`.arcade-cabinet[data-fullscreen="true"]`), and adds `data-immersive="true"`
  for the touch rules. A game picks its stage with `mobileLayout`. `scroll`,
  the default, keeps the stage a vertical scroll area and gives the cabinet
  `touch-action: pan-x pan-y`, so a game that has not had its mobile pass
  still reaches all of its content (horizontal strips such as a card hand
  included) while pinch and double-tap zoom stay ruled out. `fit` is what a
  game sets in its mobile pull request once it fits the viewport: the root
  and stage take `touch-action: none` and the stage clips with
  `overflow: hidden`.
  The toolbar and the control dock keep their own taps. On leaving immersive, the
  preview scrolls back into view. Desktop never sets the attribute, so its
  markup does not change. The exit is the cabinet's Power button in the
  immersive toolbar, which is 48px.
- **Safe areas.** The site's viewport export sets `viewportFit: "cover"`, so
  `env(safe-area-inset-*)` reports real values on notched phones. The body pads
  its left and right insets, and the fixed navbar pads its top and sides. On
  desktop every inset is 0, so the layout does not change. Pinch-zoom is not
  blocked: no `maximumScale` or `userScalable` is set.
- **Orientation.** A game declares `mobileOrientation="portrait" | "landscape" |
"either"`. PlayCabinet reads the device's orientation and, when it is held
  against the declared one, blocks the cabinet. The stage and the control dock
  are made `inert`, and `RotateDevicePrompt` covers the cabinet as an
  `alertdialog` with `aria-modal="true"`. Focus moves to its "Leave cabinet"
  button on show and returns to the element that had it when the prompt goes
  away. `either` never blocks. In real Fullscreen on a touch cabinet, the
  cabinet asks `screen.orientation.lock()` for the declared orientation and
  ignores rejections. Desktop fullscreen never asks. iOS Safari, which has no
  Fullscreen API for elements, keeps the prompt as its only tool.
- **Touch primitives.** `TouchButton` is a press-and-hold control built on
  pointer events with pointer capture. It counts each pointer that holds it, so
  two fingers on one button press it once and the release comes when the last
  finger lifts. It releases everything on blur. It is at least 44px, has a
  required accessible name, takes `touch-action: none`, vibrates through
  `lib/haptics.ts`, and also answers Enter and Space. Its press motion is gated
  with `motion-safe:`. `DockFrame` mirrors a pair of docks for left-handed play
  without changing the docks themselves. `DpadActionDock`, `TwinStickAimDock`,
  `BezelClusterDock`, `ActionStripDock` and `VirtualGamepad` remain the
  controls.
- **Control hints.** `controlHint({ key, touch })` names a control both ways, and
  `useControlHint` picks the phrase for the device. A phone reads "Tap" where a
  keyboard reads "Press Space", so game copy need not branch on input.
- **Lifecycle.** `useCabinetAutoPause(onPause)` calls its handler on
  `visibilitychange` (hidden), `pagehide`, window `blur`, and a rotation. A
  rotation listens to `screen.orientation` `change` where it exists and falls
  back to window `orientationchange` otherwise, never both. PlayCabinet passes
  the game's `onAutoPause` only while the cabinet is immersive, so a desktop
  cabinet attaches no listeners. Each game wires its own pause and resume: the
  cabinet reports the moment to stop, and the game decides when to resume.

### What this decision does not do

It does not un-gate any game. It does not change desktop behaviour at 1024px and
up, or with a fine pointer. It does not add a new fullscreen implementation: the
cabinet's existing `useFullscreen` and `CabinetFullscreen` are reused.

## Consequences

- ADR 0048's ten gated games keep the notice until their mobile pull requests
  land. Its "Try it anyway" escape hatch stays for those games.
- The Trial & Error cabinet is the first to run immersive on phones, since it is
  ungated. It keeps the `scroll` layout until its own mobile pass. The
  Playwright spec checks that its stage reaches all of its content at
  320x568 and runs an axe scan over it. Its Playwright coverage is the first real check on the kit.
- Each game's mobile pull request carries its own gate removal, screenshots and
  axe result. Reviewers judge the game against the bar, not the kit alone.
- Immersive mode locks body scroll with `overflow: hidden` and disables
  overscroll. That is not a complete scroll lock on iOS Safari. The fixed,
  full-viewport cabinet, with restricted `touch-action` on its root and stage,
  is what keeps the player's touches on the game.
- Auto-pause only reports the moment to stop. Each game owns its pause screen
  and resume rule.
- The Playwright suite gains two phone projects, "Small Phone" (320x568) and
  "Phone Landscape" (iPhone 12 landscape). They run only `mobile-kit.spec.ts`, so
  the rest of the suite does not multiply.

## Alternatives considered

- **Keep the gate on all ten games indefinitely.** Honest, but it leaves the
  arcade without a phone story and the notice is a dead end for most visitors.
- **Rebuild each game's layout responsively in one pull request.** Ten games
  would land in one review with no clear bar, and any regression would block all
  of them.
- **Force landscape with CSS transforms.** A rotated layout cannot be made
  fullscreen on iOS and breaks the browser's own orientation. The prompt asks the
  player to turn the device instead.
