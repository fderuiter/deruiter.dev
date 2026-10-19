# 0003. Mobile Responsive & Touch Interaction Standard

## Status

Accepted. Touch-device behavior for arcade games is now governed by [ADR 0061](0061-mobile-first-arcade.md) and [ADR 0062](0062-three-views-per-arcade-game.md).

## Context

The portfolio contains diverse surface areas:

1. Editorial and marketing sections (Hero with dynamic Pretext typography, Bento grid, Skills grid, Contact form).
2. Complex desktop-first engineering and scientific workspaces (CRF Studio with CDISC conformance and EDC simulation, Logical Proof Canvas with AST verification, Neuroimaging Processing Simulator with Multi-Planar MRI slices and 3D WebGL reconstruction).
3. Six interactive canvas-based arcade games (Laser Loon, Retro Labyrinth, Garmin Watch Simulator, Clinical Trial Chaos, Working With Duck, Quasi-Perfect Puzzler).

On mobile viewports (320px to 768px), desktop multi-column layouts, SVG canvas node graphs, high-frequency WebGL render loops, and mouse drag-and-drop interactions cause layout clipping, horizontal overflow, touch gesture contention (e.g. pull-to-refresh / scroll interference), and thermal throttling.

## Decision

We establish four unified architectural standards for mobile devices:

1. **Multi-Modal Mobile Stack Navigation for Studios**:
   - On screens < 768px (`md:` breakpoint), complex multi-panel studios switch from simultaneous multi-column grids to a dedicated bottom tab bar allowing users to switch between focused views (e.g. Canvas, Inspector, Ledger, Terminal).
   - Tool palettes, rule pickers, and modal configurations use slide-up bottom sheets with backdrop blur and touch dismissals.
   - SVG and Canvas graphs utilize responsive coordinate auto-scaling and dynamic `viewBox` calculations so that all nodes and edges remain visible without clipping or microscopic text.

2. **Unified Virtual Gamepad and Canvas Touch Isolation**:
   - All interactive games enforce `touch-action: none` (or `touch-action: pan-y` outside game canvases) to prevent browser touch event interception.
   - Games provide high-contrast, accessible touch controls (Virtual D-Pad and tactical action buttons with minimum 48x48px hit areas) alongside orientation helper hints and fullscreen toggles.

3. **Safe Area Inset Adaptation & Mobile WebGL Performance**:
   - Fixed navigation bars, bottom sheets, floating action buttons, and virtual controllers incorporate `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to accommodate notches, Dynamic Islands, and system home bars.
   - WebGL and 2D canvas contexts clamp `devicePixelRatio` to a maximum of 2.0 on mobile and pause render animation frames when out of viewport.

4. **Zero-Horizontal-Overflow Invariant**:
   - Every page, container, and overlay must satisfy `element.scrollWidth <= element.clientWidth` across all mobile viewports (320px, 375px, 390px, 412px, 768px).
   - Enforced via Playwright E2E and Vitest automated suites.

## Consequences

- Full-fidelity usability and finger-friendly ergonomics across all smartphones and tablets.
- Zero horizontal layout distortion or unwanted scrolling during gameplay and workspace exploration.
- Preserved 60fps frame rate and reduced battery consumption on mobile hardware.
- Fully automated test matrix preventing responsive regressions.
