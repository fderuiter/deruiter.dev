# 0006. WebGL Context Loss Recovery and GPU Resilience Architecture

Date: 2026-08-15

## Status

Accepted

## Context

Interactive 3D visualization and HTML5 canvas engines (including NeuroRecon 3D Viewer in `components/neuro/Brain3DViewer.tsx` and 2D canvas simulations across `components/arcade/` and `components/LaserLoon.tsx`) operate directly on browser GPU contexts. Under high GPU load, dual-GPU switching (e.g. integrated to discrete GPU switching on laptops), background mobile tab suspension, display disconnects/reconnects, or device sleep-wake cycles, the browser may discard WebGL and 2D canvas context to reclaim resources.

In standard WebGL / Three.js applications without isolated context lifecycle handling:

1. When `webglcontextlost` fires, if `event.preventDefault()` is not explicitly invoked, the browser marks the canvas context as permanently destroyed and will never trigger `webglcontextrestored`.
2. Continuing to execute render loops (`requestAnimationFrame`) during context loss produces unhandled WebGL errors and memory leaks.
3. Upon restoration, GPU memory (compiled shaders, vertex buffer objects, textures) is wiped clean; attempting to render without clean re-instantiation leaves blank or corrupted viewports, requiring a destructive full page reload that destroys user session state (camera rotation, active parcel hover, voxel crosshairs, autorotation settings).

## Decision

We establish an isolated, automated WebGL and 2D Canvas Context Loss Recovery architecture:

### 1. Centralized Hook and Context Lifecycle Management (`hooks/useWebGLContextLoss.ts`, `lib/webgl/context-manager.ts`)

- **Event Interception**: Attaches `webglcontextlost` and `webglcontextrestored` (alongside 2D Canvas `contextlost` and `contextrestored`) event listeners to the host canvas element.
- **Prevent Default**: Explicitly invokes `event.preventDefault()` on loss events to instruct the browser to attempt context restoration when GPU resources become available.
- **Animation Loop Guard**: Pauses and cancels active `requestAnimationFrame` ticks during the context loss state to prevent invalid GPU draw calls.
- **Lifecycle States**: Exposes typed state transitions (`idle`, `lost`, `restoring`, `restored`) and callbacks (`onContextLost`, `onContextRestored`).

### 2. Clean Three.js Resource Re-instantiation in `Brain3DViewer.tsx`

- **Full Renderer & Buffer Re-instantiation**: On `webglcontextrestored`, the viewer cleanly disposes stale `THREE.WebGLRenderer` references, instantiates a fresh renderer instance, and regenerates geometry buffers, normal attributes, and shader materials.
- **100% User Session State Preservation**: Retains exact camera azimuth/elevation, `rotationRef` angles, active surface mode (`pial`, `white`, `inflated`, `aparc`, `aseg`), hemisphere filter (`both`, `lh`, `rh`), wireframe mode, voxel crosshair coordinates `(x, y, z)`, and autorotation preferences without loss.

### 3. User Experience & Accessibility Announcements

- **Visual HUD Status Indicator**: Displays a non-intrusive, styled HUD status pill in the viewer header indicating "GPU Context Interrupted — Re-instantiating..." during loss, transitioning smoothly to a "GPU Context Restored" confirmation badge before fading.
- **Screen Reader Announcements**: Integrates with `useAnnouncer` / `A11yProvider` to issue polite screen reader vocalizations when graphics contexts are lost and restored.

### 4. Deterministic Simulation & Automated Testing Harness

- **Simulation Interface**: `simulateContextLoss()` in `lib/webgl/context-manager.ts` leverages the `WEBGL_lose_context` extension (or synthetic event dispatch in test/headless environments) to trigger deterministic loss and restoration cycles.
- **Automated Verification**: Vitest unit/integration suites (`__tests__/webgl-context-loss.test.tsx`, `__tests__/canvas-recovery.test.ts`) verify default prevention, loop cancellation, buffer re-instantiation, and session state persistence.
- **Developer Debug Action**: Adds an interactive "Simulate GPU Interruption" trigger in the field manual / developer debug bar for live verification.

## Invariant Compliance

- **AGENTS.md Invariant 6 (DX & Quality)**: Verified via Vitest unit suites and `npm run quality`.
- **AGENTS.md Invariant 7 (Canvas Testing & Lifecycle)**: Strict cleanup of animation frames and mock contexts during context loss and restoration cycles.
- **AGENTS.md Invariant 10 (Accessibility)**: Live announcer updates and accessible fallback status for screen readers.

## Consequences

### Positive

- Guarantees 100% session preservation across GPU switching, laptop power-saving modes, and mobile tab suspension.
- Eliminates page crash and blank canvas bugs without requiring page reloads.
- Centralizes context resilience logic in reusable utilities for both WebGL and 2D canvas engines.
- Provides accessible status cues to screen reader users and visual HUD feedback.

### Negative / Trade-offs

- Requires re-compilation of shaders and vertex buffers upon restoration, which incurs a negligible one-time frame tick (<16ms) during recovery.
