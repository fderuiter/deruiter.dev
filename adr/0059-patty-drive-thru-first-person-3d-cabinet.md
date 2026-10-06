# ADR 0059: Patty's Drive-Thru First-Person 3D Cabinet

## Status

Proposed on 2026-10-06, under the epic
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

The repository already depends on `three` (the neuro viewer uses it directly,
without React Three Fiber). React Three Fiber, drei and Rapier are not
dependencies.

## Decision

1. **Engine/scene split.** All rules live in a headless, seeded module,
   `lib/patty-drive-thru/` (#1812), per ADR 0026. The 3D scene only renders
   engine state and forwards input. The engine is tested in Node; the scene is
   stubbed in JSDOM like the neuro viewer.
2. **Plain Three.js, not React Three Fiber.** The scene uses `three`
   directly, loaded with `next/dynamic` only after the cabinet launches. This
   reuses the dependency and the pattern the neuro viewer already proves, adds
   no reconciler or drei/Rapier packages to the lockfile and license audit
   (ADR 0057), and keeps the render loop out of React. If R3F turns out to be
   needed for the later walking slices, it is reconsidered in a new ADR.
   _This departs from the R3F stack sketched in the #836 comments and needs the
   owner's confirmation._
3. **Chunk budget.** The scene chunk must stay under the default 350 kB gzip
   single-chunk ceiling with tree-shaken imports (named `three` imports only,
   no `three/examples` loaders in the first slice). A dedicated entry in
   `LAZY_VENDOR_CHUNK_BUDGETS` is added only if measurement in #1813 shows the
   default cannot hold, with the measured size recorded in that PR.
4. **Diegetic screens.** The KDS is a canvas texture on an emissive material.
   The POS is real DOM (buttons, nested menus) positioned over the canvas
   during focus-zoom, so it is keyboard- and screen-reader-operable.
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

- One heavier lazy chunk, loaded only on the cabinet route; the hub and other
  cabinets are unaffected.
- The first slice stays small: no walking, physics or coworker AI. Those are
  later slices and may justify R3F and Rapier in a follow-up ADR.
- The engine/scene split keeps nearly all behaviour testable without WebGL.
- The visual exception adds one scoped token set to maintain and one more
  place the editorial rules do not apply.

## Alternatives considered

- **React Three Fiber, drei and Rapier now.** Matches the #836 comments, but
  adds three dependencies and a reconciler before the first slice needs
  physics or a scene graph that large.
- **2D pixel-art booth.** Cheaper, but looks like the other cabinets, which the
  owner ruled out.
- **Pointer-lock only.** Fails the keyboard-playable requirement.
