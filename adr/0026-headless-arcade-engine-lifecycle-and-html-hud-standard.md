# ADR 0026: Headless Arcade Engine Lifecycle, Viewport Matrix, and HTML HUD Overlay Standard

## Status

Accepted

## Context

The portfolio features seven interactive arcade experiences across `app/arcade/` (`laser-loon`, `retro-labyrinth`, `garmin-watch`, `clinical-chaos`, `working-with-duck`, `quasi-puzzler`, `meme-vault`). Previously, these games suffered from architectural coupling and rendering limitations:

1. **Monolithic React Coupling**: Components such as `RetroLabyrinth.tsx` (2,131 lines), `WorkingWithDuck.tsx` (3,430 lines), `LaserLoon.tsx` (2,243 lines), and `ClinicalTrialChaos.tsx` (2,291 lines) mixed React component state, canvas animation frame loops, physics math, collision detection, Web Audio triggers, and local storage snapshots in a single file.
2. **Display Resolution & Blurry Canvas**: Games hardcoded canvas pixel dimensions without dynamic High-DPI (Retina) Device Pixel Ratio (DPR) scaling, causing blurry rendering on mobile and Retina screens.
3. **Competing Input Handlers**: Components bound up to 11 concurrent mouse, touch, and pointer listeners, leading to duplicate event firing and touch cancellation glitches.
4. **Garbage Collection Pauses**: High-frequency entity allocations (particles, shockwaves, laser projectiles) created micro-stutters on mobile devices.
5. **Inaccessible Text in Canvas**: Scores, instructions, and status metrics were drawn via `ctx.fillText`, degrading responsiveness, accessibility, and visual crispness.

## Decision

We adopt a unified, deep modular architecture across all arcade games:

1. **Headless TypeScript Engine Layer (`lib/arcade/core/`)**:
   - **`ArcadeEngine` Base Contract**: Pure framework-agnostic classes with an explicit lifecycle (`init`, `update(dt)`, `render(ctx, alpha)`, `destroy`, `resize(w, h, dpr)`).
   - **`ArcadeGameLoop`**: Fixed 60Hz deterministic physics timestep with an accumulator and sub-frame alpha render interpolation.
   - **`ArcadeViewport`**: Archetype-aware scaling providing:
     - _Safe Zone & Bleed Matrix_: `ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr)` for action and simulation games (`LaserLoon`, `ClinicalTrialChaos`, `WorkingWithDuck`).
     - _Integer-Scaled Letterboxing_: Crisp aspect-ratio containment for pixel-art and hardware simulators (`RetroLabyrinth`, `GarminWatchSimulator`).
     - _Coordinate Inverse-Transform_: Defensive translation from screen pointer events to game coordinates with zero division-by-zero risk.
   - **`ArcadeInputManager`**: Unified Pointer Event and Keyboard capture normalizing inputs into a standardized action vector.
   - **`ObjectPool<T>`**: Zero-allocation entity recycling for projectiles, particles, and floating damage numbers with configurable FIFO eviction for cosmetic emitters.

2. **React 19 Shell & HTML HUD Overlay Pattern**:
   - React components act as thin shells (150–250 lines) mounting the canvas and subscribing to state via `useSyncExternalStore` (`engine.getSnapshot()`).
   - Static HUDs, scoreboards, level timers, inventory trays, and touch controls live in absolute-positioned responsive HTML/CSS overlays (`#ui-layer`).
   - `ctx.fillText` is strictly restricted to in-world diegetic elements (floating damage pops, moving entity labels).

3. **Centralized Audio Unlocking**:
   - Web Audio context initialization is orchestrated centrally via `<PlayCabinet>` upon user launch/interaction, passing an initialized audio bridge to the engine.

## Consequences

- **Positive**:
  - Eliminates 7,000+ lines of monolithic React component complexity.
  - Game engines become 100% testable in pure Node.js/Vitest without JSDOM or React wrappers.
  - Crystal-clear rendering across all High-DPI mobile, tablet, and 4K displays.
  - Zero-GC frame rates and rock-solid 60 FPS determinism across all monitor refresh rates (60Hz–144Hz).
  - Full WCAG 2.1 AA accessibility and screen reader synchronization.
- **Negative**:
  - Requires migrating existing game state models into headless engine classes across 7 games.
