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

The kit lives in `components/arcade/mobile/` with a barrel `index.ts`. It builds
on the existing controls rather than replacing them.

- **Immersive touch cabinet.** On a coarse pointer under 1024px, a launched
  cabinet is fixed to the viewport at `h-dvh`, padded by the safe-area insets,
  with page scroll locked and overscroll disabled. It reuses the fullscreen
  layout and its CSS (`.arcade-cabinet[data-fullscreen="true"]`), and adds
  `data-immersive="true"` for the touch rules. The stage takes
  `touch-action: none`. The toolbar and the control dock stay outside the stage
  and keep their taps. Desktop never sets the attribute, so its markup does not
  change. The exit control is the cabinet's Power button, at least 48px, and it
  is always on screen.
- **Orientation.** A game declares `mobileOrientation="portrait" | "landscape" |
  "either"`. When the phone is held against a declared orientation, the cabinet
  covers with `RotateDevicePrompt`, which offers "Leave cabinet". `either` never
  prompts. In real Fullscreen the cabinet asks `screen.orientation.lock()` for
  the declared orientation and ignores rejections. iOS Safari, which has no
  Fullscreen API for elements, keeps the prompt as its only tool.
- **Touch primitives.** `TouchButton` is a press-and-hold control built on
  pointer events with pointer capture, so two fingers on two buttons both count
  and a finger that slides off still releases. It is at least 44px, has a
  required accessible name, vibrates through `lib/haptics.ts`, and also answers
  Enter and Space. `DockFrame` mirrors a pair of docks for left-handed play
  without changing the docks themselves. `DpadActionDock`, `TwinStickAimDock`,
  `BezelClusterDock`, `ActionStripDock` and `VirtualGamepad` remain the
  controls; the kit adds handedness and the pieces they lacked.
- **Control hints.** `controlHint({ key, touch })` names a control both ways, and
  `useControlHint` picks the phrase for the device. A phone reads "Tap" where a
  keyboard reads "Press Space", so game copy need not branch on input.
- **Lifecycle.** `useCabinetAutoPause(onPause)` calls the game's handler on
  `visibilitychange` (hidden), `pagehide`, window `blur` and orientation change.
  PlayCabinet passes it the game's `onAutoPause` only while the cabinet is
  immersive, so a desktop cabinet attaches no listeners.

### What this decision does not do

It does not un-gate any game. It does not change desktop behaviour at 1024px and
up, or with a fine pointer. It does not add a new fullscreen implementation: the
cabinet's existing `useFullscreen` and `CabinetFullscreen` are reused.

## Consequences

- ADR 0048's ten gated games keep the notice until their mobile pull requests
  land. Its "Try it anyway" escape hatch stays for those games.
- The Trial & Error cabinet is the first to run immersive on phones, since it is
  ungated. Its Playwright coverage is the first real check on the kit.
- Each game's mobile pull request carries its own gate removal, screenshots and
  axe result. Reviewers judge the game against the bar, not the kit alone.
- Immersive mode locks body scroll with `overflow: hidden` and disables
  overscroll. That is not a complete scroll lock on iOS Safari. The fixed,
  full-viewport cabinet, with `touch-action: none` on its stage, is what keeps
  the player's touches on the game.
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
