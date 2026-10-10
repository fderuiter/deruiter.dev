# ADR 0059: Patty's Drive-Thru First-Person 3D Cabinet

## Status

Accepted on 2026-10-06, under the epic
[#836](https://github.com/fderuiter/deruiter.dev/issues/836) and its child
[#1811](https://github.com/fderuiter/deruiter.dev/issues/1811). Builds on
[ADR 0026](0026-headless-arcade-engine-lifecycle-and-html-hud-standard.md) and
[ADR 0048](0048-desktop-only-arcade-games-on-touch-devices.md), and takes the
same scoped-exception approach as the card-table amendment to
[ADR 0046](0046-trial-and-error-biostat-ops-architecture.md).

## Context

_Patty's Drive-Thru_ is a playable diary entry from the owner's first job
(2014 to 2017). The first slice is one drive-thru booth: a fixed standing
position with a 180-degree pivot between a ceiling order screen (KDS), a
clunky POS touchscreen and the headset. It must look and feel unlike every
other cabinet, all of which are 2D canvas on graphite chrome. That means a
fluorescent first-person 3D scene.

Three constraints from existing rules shape the design:

- The site's editorial rules prohibit glow washes, particle loops and
  off-palette surfaces, with one scoped arcade-cabinet exception for
  event-driven loud moments.
- Canvas games must be keyboard-playable with an accessible fallback, so a
  pointer-lock-only game is not allowed.
- Bundle budgets cap one lazy chunk at 350 kB gzip (`lib/dx/bundle-guard.ts`).

The repository already depends on `three` (used directly by the neuro
viewer) and `zustand`. React Three Fiber (R3F), drei and Rapier are not
dependencies. R3F 9 supports React 19 and `three` 0.156 or later, and all
three libraries are MIT, which ADR 0057 allows.

## Decision

1. **Engine/scene split.** All rules live in a headless, seeded module,
   `lib/patty-drive-thru/` (#1812), per ADR 0026. The 3D scene only renders
   engine state and forwards input. The engine is tested in Node; the scene is
   stubbed in JSDOM like the neuro viewer.
2. **React Three Fiber, drei and Zustand now; Rapier with the walking slice.**
   The scene is declarative R3F with drei helpers, loaded with `next/dynamic`
   only after the cabinet launches. High-frequency values (shift clock, meters,
   camera yaw) live in a Zustand store read with `getState()` inside
   `useFrame`, so ticking state never re-renders React. Rapier is added by
   the ADR or issue that introduces walking, collisions or slippery floors,
   because the booth slice needs no physics and an unused dependency is dead
   weight. The neuro viewer stays on plain `three`.
3. **Chunk budget.** The scene chunk must stay under the default 350 kB gzip
   single-chunk ceiling with tree-shaken imports (named `three` and drei
   imports only, no loaders in the first slice). A dedicated entry in
   `LAZY_VENDOR_CHUNK_BUDGETS` is added only if measurement in #1813 shows the
   default cannot hold, with the measured size recorded in that PR.
4. **Diegetic screens.** The KDS is a canvas texture on an emissive material.
   The POS is real DOM (buttons, nested menus), shown through drei `Html` on
   the screen mesh and promoted to a plain overlay during focus-zoom, so it is
   keyboard- and screen-reader-operable.
5. **Controls.** Mouse look with a small rotational drag, A/D and arrow keys
   to turn, Enter and Tab for the POS, Escape to release pointer lock. Every
   action is reachable by keyboard alone.
6. **Fallbacks.** If WebGL is unavailable or the visitor prefers reduced
   motion, the cabinet shows a flat two-pane view (order screen and POS) over
   the same engine, plus a text description of the booth. The desktop-only
   gate from ADR 0048 applies.
7. **Scoped visual exception.** The cabinet may use a warm fluorescent,
   desaturated "grimy kitchen" palette inside the launched `PlayCabinet`,
   scoped to a `[data-pdt-cabinet]` attribute with `--pdt-*` tokens. Motion
   effects (screen vignette, chromatic aberration at the panic threshold) are
   event-driven, disabled under `prefers-reduced-motion` and below 768px, and
   animate only `transform` and `opacity` where the DOM is involved. Nothing
   leaks outside the cabinet, and continuous particle loops stay prohibited.
8. **Audio.** Web Audio with a left "headset" and right "kitchen" channel,
   muted by default until the first user gesture, skipped when
   `(hover: none)` matches, and torn down on unmount.
9. **Brand and people.** The chain is fictional. No McDonald's name, logo,
   arches, trade dress or menu names appear in code, copy or assets. Real
   people from the diary are renamed; the harassing manager is given a clearly
   different name and blurred details. The name "Patty's Drive-Thru" needs a
   trademark and domain check before public launch (#1815).

## Consequences

- Two new runtime dependencies (`@react-three/fiber`, `@react-three/drei`) and
  one heavier lazy chunk, loaded only on the cabinet route; the hub and other
  cabinets are unaffected. Both go through the license audit and the
  acknowledgments page (ADR 0057).
- The first slice stays small: no walking, physics or coworker AI. Rapier
  arrives with those slices.
- The engine/scene split keeps nearly all behaviour testable without WebGL.
  R3F scenes are tested through their store and engine, with the `Canvas`
  stubbed in JSDOM.
- The visual exception adds one scoped token set to maintain and one more
  place the editorial rules do not apply.

## Amendment (2026-10-06): booth build

Recorded with the booth scene
([#1813](https://github.com/fderuiter/deruiter.dev/issues/1813)). Building it
changed decisions 2, 4 and 5. The engine/scene split, the fallbacks, the
scoped palette, the audio rules and the brand rules above are unchanged.

### No drei

drei's `Html` mounts its DOM in a separate React root. Under React 19 that
root unmounted during the scene's own render, which logged "synchronously
unmount a root" and `removeChild` errors and left the POS mirror blank. No
other drei helper was in use, so drei is not a dependency. The scene uses
`@react-three/fiber` and `three` only.

### Both screens are canvas textures; the register is a DOM overlay

The KDS and the POS are drawn into canvas textures on unlit materials, and
the drive-thru timer is a third. Each redraws on a 250 ms interval, and only
when the data it shows has changed, so a ticking clock never re-uploads a
texture. The textures are disposed on unmount.

The operable register is a plain DOM overlay, the same component the flat
view uses. It opens with Enter or Tab, or a click on the register screen in
the booth, and moves focus to its first usable key. Escape closes it and
returns focus to the cabinet. While it is open the camera turns to the
register and narrows its field of view, which hides the lane.

### Drag to look instead of pointer lock

Looking around is a click-and-drag with a little rotational drag, plus A/D
and the arrow keys. A click that moves less than 6 pixels counts as a click,
not a drag. Pointer lock is not used, so there is nothing to release, and
Escape only leaves the register.

### Rendering on demand

The canvas uses `frameloop="demand"`. It draws a frame when the store or the
camera changes, so an idle booth costs no GPU time. A `webglcontextlost`
event switches the cabinet to the flat view, except the one React Three Fiber
fires itself after unmount.

### Dependencies and chunk size

One runtime dependency, `@react-three/fiber`, and one development
dependency, `@react-three/test-renderer`, which renders the booth scene in
Vitest without WebGL. Both are MIT and listed on the acknowledgments page.

Measured on a production build on 2026-10-06, launching the cabinet loads
47 kB gzip of game code. Clocking in to the 3D booth then loads five more lazy
chunks, 245 kB gzip in total. The largest is the `three` core at 98 kB, well
under the 350 kB single-chunk ceiling, so decision 3 holds without a
dedicated budget entry. The flat view loads none of the 3D chunks.

## Alternatives considered

- **Plain Three.js, as the neuro viewer does.** Lighter, with no new
  dependencies, but an imperative scene graph and hand-built DOM-on-mesh
  plumbing for the POS. Rejected in favour of the declarative stack the owner
  chose, which also suits the later walking slices.
- **R3F with Rapier from the start.** Matches the #836 comments exactly but
  ships an unused physics engine in the first slice.
- **2D pixel-art booth.** Cheaper, but looks like the other cabinets, which the
  owner ruled out.
- **Pointer-lock only.** Fails the keyboard-playable requirement.

## Amendment (2026-10-10): practice scenarios and shift data

Issue [#1887](https://github.com/fderuiter/deruiter.dev/issues/1887) adds four
named shifts (standard, lunch rush, failing dispenser, strict management) and
a download of a shift's data. A scenario is a set of clamped dials on
`ShiftConfig` (`SCENARIO_LIMITS`); it never sets a seed, so every shift stays
fresh. Only the standard shift records an arcade score, because an easier
scenario would otherwise inflate the board and the trophies. The POS menu is
not configurable: the clunky register is the diary's point. The booth store
keeps a capped log of the events that happened, and the JSON and CSV exports
read that log rather than re-simulating the shift.
