# 0019. Standardized Arcade Viewport & Touch Control Architecture

Date: 2026-08-19

## Status

Accepted

## Context

The portfolio features seven distinct interactive arcade experiences across `app/arcade/`:

1. **Laser Loon** (`laser-loon`): Raycast laser collision and cryo-shatter shooter.
2. **Retro Labyrinth** (`retro-labyrinth`): 2.5D roguelike dungeon crawler and TSP optimizer.
3. **Garmin Watch Simulator** (`garmin-watch`): Physical smartwatch hardware, MIP display, and thermal emulator.
4. **Clinical Trial Chaos** (`clinical-chaos`): Multi-subject clinical triage and EDC protocol simulator.
5. **Working With Duck** (`working-with-duck`): Interactive pet simulation and mini-game engine.
6. **Quasi-Perfect Puzzler** (`quasi-puzzler`): Deductive Lean/AST formal verification puzzle game.
7. **Meme Vault** (`meme-vault`): High-density audio/visual soundboard and meme remixer.

While desktop experiences function smoothly with physical keyboards and mice, mobile and tablet viewports (320px to 768px) previously suffered from three critical usability failures:

1. **Vertical Overflow & Scroll Contention**: Page headers, breadcrumbs, canvas containers, and controls exceeded viewport height (800+ px content on 568–852 px mobile screens), pushing touch controls below the fold and causing browser scroll interception during gameplay.
2. **Control Fragmentation**: Games lacked a cohesive touch input standard, alternating between missing touch controls, ad-hoc button layouts, and mismatched touch target sizes.
3. **GPU & Battery Stress on Mobile**: High-density Retina displays (3x DPR) paired with unthrottled CRT scanlines, canvas filters, and particle simulations caused thermal throttling and frame drops on mobile devices.

## Decision

We establish four unified architectural standards governing all arcade experiences:

### 1. Viewport-Budgeted Game Shell (`PlayCabinet`)

- When the cabinet launches, the active game container dynamically bounds its height to the remaining screen space:
  $$\text{MaxCanvasHeight} = \min\left(\text{Width} \times \text{Aspect}, 100\text{dvh} - \text{SafeInsets} - \text{HUDHeight} - \text{ControlsDockHeight}\right)$$
- Guarantees that the game canvas, score/status HUD, and interactive touch controls fit completely within a single screen fold with **zero page scrolling required**.
- Provides a dedicated 1-tap **Fullscreen / Stage Mode** toggle (`FullscreenButton.tsx`) for players seeking an uninterrupted full-window arcade canvas.

### 2. Archetype-Based Control Docks

Games plug into one of four standardized touch control archetypes inside the cabinet:

- **`DpadActionDock`**: 4-way virtual D-Pad + Action A/B buttons + weapon selector (Retro Labyrinth).
- **`TwinStickAimDock` / `DirectTouchCrosshair`**: Left thumbstick / drag surface + Primary Fire + Tremolo + Arsenal pills (Laser Loon).
- **`BezelClusterDock`**: 5 hardware buttons (Light, Up, Down, Start/Stop, Back/Lap) docked around or beneath the watch chassis (Garmin Watch).
- **`ActionStripDock`**: Swipeable horizontal or grid touch cards with min 48×48px hit areas (Clinical Chaos, Working with Duck, Quasi-Perfect Puzzler, Meme Vault).

All control docks enforce:

- Minimum **48×48px touch targets** (WCAG 2.1 AA).
- `touch-action: none` with pointer capture to eliminate scroll dragging and ghost taps.
- Tactile feedback (`active:scale-[0.96]`) and Web Audio synthesized sound effects.

### 3. Responsive Canvas Lifecycle Engine (`useResponsiveCanvas`)

- **DPR Clamping**: Clamps `devicePixelRatio` to $\le 2.0$ on desktop/tablet, and $\le 1.0$ on low-power mobile or when CRT scanline shaders are active.
- **Coordinate Normalization**: Normalizes touch/mouse coordinates defensively ($X_{game} = (X_{touch} - \text{rect.left}) \times \frac{W_{internal}}{\max(1, \text{rect.width})}$) with zero division-by-zero risk.
- **Context Loss Resilience**: Automated event interception for 2D/WebGL `contextlost` and `contextrestored` events per ADR 0006.

### 4. 3-Pillar Inclusive Accessibility Protocol

- **Live Screen Reader Mirror**: Embedded off-screen `<div className="sr-only" role="region" aria-live="polite">` announcing game milestone states, boss alerts, health updates, and objective completions.
- **High-Contrast Focus Indicators**: High-contrast `:focus-visible` rings on all interactive cabinet controls.
- **1:1 Input Parity**: Full keyboard mapping parity for all virtual touch actions.

## Consequences

- 100% playability and visual containment across all mobile smartphones (320px+), tablets (768px+), and desktop screens.
- Zero touch gesture contention with browser scrolling.
- Consistent 60fps frame rates and reduced mobile battery drain.
- Full compliance with WCAG 2.1 Level AA accessibility and AGENTS.md quality invariants.
