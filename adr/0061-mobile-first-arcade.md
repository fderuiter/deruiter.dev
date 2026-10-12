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
rather than replacing them. Retro Labyrinth is the first consumer of TouchButton,
DockFrame and HoldDpad. The remaining helpers, including the control-hint
helpers, await their first game consumer.

- **Immersive touch cabinet.** On any touch device (`TOUCH_DEVICE_QUERY`, see
  the amendment below), the cabinet goes immersive when it launches and stays
  immersive until the player exits. The device class is latched at Launch, so
  an iPad that turns mid-game keeps the layout it started with. The cabinet is fixed to the
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
  immersive toolbar. That toolbar is one row of icon-only 44px keys (Fullscreen
  where the API exists, Setup, Power), floats top-right inside the safe area,
  and publishes its width as `--cabinet-toolbar-inset`, so a game HUD can pad
  for it. Fullscreen is hidden on iOS, which has no Fullscreen API.
- **Safe areas.** The site's viewport export sets `viewportFit: "cover"`, so
  `env(safe-area-inset-*)` reports real values on notched phones. The body pads
  its left and right insets, and the fixed navbar pads its top and sides. On
  desktop every inset is 0, so the layout does not change. Pinch-zoom is not
  blocked: no `maximumScale` or `userScalable` is set.
- **Orientation.** A game declares `mobileOrientation="portrait" | "landscape" |
"either"`. On a phone (`PHONE_QUERY`), PlayCabinet reads the device's
  orientation and, when it is held against the declared one, blocks the
  cabinet. Tablets are never asked to turn. The stage and the control dock
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
  with `motion-safe:`. `DockFrame` lays a dock row out for the player's hand
  (`handedness`), reversing the order of its two sides; Retro Labyrinth reads
  it from its Options sheet. `DpadActionDock`, `TwinStickAimDock`,
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

- ADR 0048's ten gated games keep the notice on phones until their mobile pull
  requests land. The notice now shows only where `PHONE_QUERY` matches, so
  iPads play every game. Its "Try it anyway" escape hatch stays for those
  games on phones.
- The Trial & Error cabinet is the first to run immersive on phones, since it is
  ungated. It keeps the `scroll` layout until its own mobile pass. The
  Playwright spec checks that its stage reaches all of its content at
  320x568 and runs an axe scan over it. Its Playwright coverage is the first real check on the kit.
- Each game's mobile pull request carries its own gate removal, screenshots and
  axe result. Reviewers judge the game against the bar, not the kit alone.
- Immersive mode pins the body with `position: fixed` at its scroll position,
  with `overflow: hidden` and no overscroll, and restores the position on exit.
  Overflow alone let a script scroll the page behind the cabinet. iOS Safari
  still needs the fixed pin as well as the restricted `touch-action`. The fixed,
  full-viewport cabinet, with restricted `touch-action` on its root and stage,
  is what keeps the player's touches on the game.
- Auto-pause only reports the moment to stop. Each game owns its pause screen
  and resume rule.
- The Playwright suite gains two phone projects, "Small Phone" (320x568) and
  "Phone Landscape" (iPhone 12 landscape). They run only `mobile-kit.spec.ts`, so
  the rest of the suite does not multiply.

## Amendment (2026-10-12): Retro Labyrinth leaves the gate

Retro Labyrinth passed the phone bar in its own change (#2003) and left
`DesktopOnlyGate`. Its cabinet declares `mobileOrientation="landscape"` and
`mobileLayout="fit"`, and wires `onAutoPause` to the game's pause, so a
running room pauses on hide, blur or rotation and waits for a tap on Resume.

- **Orientation.** Landscape. At 812x375 the maze is about 455x273 CSS
  pixels, with the d-pad on the left and the actions on the right. Upright,
  the same maze is width-bound at 343 pixels with the rest of the screen
  empty. A phone held upright gets the rotate prompt, as the kit prescribes.
- **Controls.** A three-by-three d-pad that repeats while held, at 44px keys
  on the phone dock, and tool, EMP, Exploit and Market buttons at 44px on a
  two-column grid, all built on the kit's `TouchButton`. The side columns are
  only as wide as their keys, plus the safe-area insets.
- **Maze size.** On the touch cabinet the maze fills the largest 5:3 box its
  dock leaves, with a CSS width that is a multiple of 5 px and a backing store
  at the device pixel ratio, sampled nearest-neighbour. Measured on the
  Playwright Small Phone at 2x: 520x312 CSS px (1040x624 device px) at
  812x375, and 310x186 CSS px (620x372 device px) at 568x320. At 568x320 the
  side docks take the width and the 5:3 box then limits the height to 186 px,
  so the maze is 58% of the screen height, short of the 250 px that was
  aimed for. Reaching 250 px would need a different aspect ratio or cropping
  the maze, and both break the art, so the shortfall is accepted. A swipe
  across the maze moves one step, and a tap does nothing.
- **Fractional scale and #1522.** Desktop keeps the integer scale of the
  visual overhaul (#1522, closed), so every art pixel is the same size. The
  phone trades that for size: a fractional scale means some art pixels are one
  device pixel wider than others. The trade is taken because an integer scale
  leaves a quarter of a phone screen empty, and the nearest-neighbour sampling
  keeps the edges crisp.
- **HUD.** One slim 44px row on the same top line as the toolbar: floor, HP,
  score, and an Options button, padded on the right by
  `--cabinet-toolbar-inset`. The objective is not repeated in the HUD; the
  maze's own in-world line carries it. Options open a sheet over the maze that
  pauses a running room. The hotbar is desktop only. Entering real fullscreen
  asks for the landscape lock, which can resize the page and so raise one
  auto-pause; the room then waits for Resume like any other pause.
- **Kit additions.** `createHoldRepeater` and `useHoldRepeat`, `HoldDpad`,
  `swipeDirection`, and `CabinetTouchContext`, which tells a game it is in
  the immersive touch cabinet.
- **Market.** The darknet Market is a modal dialog on every device, with a
  focus trap, Escape to close, and focus back on the key that opened it. Its
  list is a labelled, keyboard-focusable region; a "More below" cue shows
  while items sit under the fold. Price buttons and Close are at least 44px on
  a coarse pointer. Purchases go through the same handler on both devices.
- **Patrol warning.** A live patrol one orthogonal step from the player turns
  the maze frame red and pulses it (motion-safe), shows "Patrol adjacent" in
  the HUD, and buzzes once through `triggerHaptic` when the warning begins.
  The warning is drawn on the frame, not per cell. Desktop has no warning, so
  nothing changes there.
- **Launch and exit.** Launch pins the page at its offset. Exit restores that
  exact offset, so the preview returns where the player left it with no jump;
  the earlier scroll-into-view on exit was removed.
- **Overlay headings.** Overlay titles are level-two headings, so the page's
  heading order stays valid under axe.
- **Room cleared.** The room-cleared card, the Market and the phone tool
  labels are shared components or labels with their own unit tests. The
  phone label for the port scan reads "Scan".
- **Hub.** The "Desktop only" badge now follows an explicit `desktopOnly`
  flag per card. Eight games carry it (the hub lists ten cards). Retro
  Labyrinth and Trial & Error do not, so Trial & Error no longer shows a badge
  it never needed.

The other eight gated games keep the notice until their own mobile pull
requests land.

## Alternatives considered

- **Keep the gate on all ten games indefinitely.** Honest, but it leaves the
  arcade without a phone story and the notice is a dead end for most visitors.
- **Rebuild each game's layout responsively in one pull request.** Ten games
  would land in one review with no clear bar, and any regression would block all
  of them.
- **Force landscape with CSS transforms.** A rotated layout cannot be made
  fullscreen on iOS and breaks the browser's own orientation. The prompt asks the
  player to turn the device instead.

## Amendment (2026-10-13): Tablet-first

The phone bar stays. The priority moves to the iPad: a tablet is the arcade's
primary touch device, and phones are parked until a later change. Fred's
direction was to make every game perfect on an iPad first.

- **Phones parked behind the narrowed gate.** The gate (ADR 0048) and the
  hub's "Desktop only" badges use `PHONE_QUERY`:
  `(pointer: coarse) and ((max-width: 743px) or (max-height: 500px))`. That is
  phones in either orientation, plus a touch device whose window is narrower
  than 744px. The 743px bound is deliberate: a full-screen iPad mini in portrait
  is 744px wide and is a tablet. Every iPad Split View pane of a 1024px screen
  (507px, 678px) is a phone, so Split View keeps the gate. Gated games are not
  removed from the gate here; they stop being gated on tablets.
- **Immersive on every touch device.** The cabinet latches immersive at Launch
  on `TOUCH_DEVICE_QUERY` (`(pointer: coarse)`), so tablets in both orientations
  get it at every width. The rotate prompt and the Screen Orientation lock apply
  to phones only (`PHONE_QUERY`), since `mobileOrientation` is a phone concern.
  Desktop with a fine pointer is unchanged.
- **Apple Pencil.** Pointer events with `pointerType` `"pen"` are treated as
  touch by the kit. `TouchButton` captures, counts and releases a Pencil and a
  finger on one control as one press, and the control hints read "Tap".
- **Keyboard case modality.** `useInputModality()` returns `"touch"`, `"pen"`,
  `"keyboard"` or `"mouse"` from the last `pointerdown` type or a hardware key.
  Modifier-only keys and keys typed into a text-like field do not count.
  Switch Control and Full Keyboard Access send keydowns and count as keyboard
  use by design: the controls hide until the next touch. It starts on
  touch for a coarse pointer and on mouse otherwise, and it is SSR-safe through
  `useSyncExternalStore`. The immersive cabinet root carries
  `data-input-modality`, and `TouchControlsGate` hides the on-screen controls
  while the keyboard or a trackpad is in use. The controls stay mounted and
  hit-testable (`opacity-0`, not `inert`), so the first tap after a key press
  lands on the control; they leave the Tab order and the accessibility tree
  while hidden. The next touch brings them back.
  `useTouchHint` and `useControlHint` follow the modality, so a keyboard case
  reads "Press Space" and a finger reads "Tap".
- **Split View by container width.** The cabinet root is an `@container`, so
  games lay out by the width of their own container, not the window. A game
  that lays out by container width fits a Split View pane without a separate
  layout. The Playwright spec checks the immersive cabinet at 507x1024 and
  678x1024 on an ungated cabinet, the gate and its "Try it anyway" at the same
  sizes, and the immersive cabinet at 768px and wider.
- **Tablet device matrix.** Chromium with touch emulation, `hasTouch`, `isMobile`
  and a device scale factor of 2 stands in for iPad Safari. Each size runs in
  portrait and landscape: iPad mini 744x1133, iPad Air 820x1180, iPad Pro 11
  834x1194 and iPad Pro 13 1024x1366, with their landscape pairs. The projects
  run only `tablet-kit.spec.ts` and the later `*-tablet.spec.ts` files. The
  existing Tablet Safari (WebKit) project is unchanged. Real iPad Safari remains
  the final check before a game's tablet pull request merges.

### Gated games, after this amendment

The ten games under ADR 0048 keep their notice on phones only. A game leaves
`DesktopOnlyGate` in its own mobile pull request once it meets the phone bar.
Each game's tablet work is a `*-tablet.spec.ts` file in the tablet projects.
