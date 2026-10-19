# 0002. Deterministic Client-Side AST Engine and Hybrid Interaction Model for Formal Methods Arcade

## Status

Accepted

## Context

The portfolio features interactive engineering showcases, including a formal methods puzzle game ("Quasi-Perfect Puzzler") themed around proof assistants (Lean 4, Coq) and mathematical verification. Real formal proof assistants require heavyweight language servers, WebAssembly runtimes (e.g. Lean 4 WASM > 50MB), or serverless backend runners with significant latency, memory, and cold-start overhead. Furthermore, mobile touchscreens and desktop pointer devices require distinct interaction ergonomics when manipulating mathematical syntax trees.

## Decision

We chose to implement a pure TypeScript AST (Abstract Syntax Tree) transformation and tactic evaluation engine in `lib/quasi-perfect/` with zero external runtime dependencies. The engine implements deterministic, rule-based mathematical reductions for tactics (`rfl`, `rw`, `simp`, `decide`, `omega`, `linarith`, `sorry`).

For user interaction and accessibility:

1. **Hybrid Interaction**: Desktop users can drag-and-drop tactic cards directly onto AST tree nodes with real-time bounding collision detection, while mobile users can tap cards and tap target nodes, and keyboard users can navigate via a focus reticle (`Tab`, `Space`, `Enter`).
2. **Deterministic Resource Economics**: Tactic steps consume simulated "Lean Server RAM", imposing puzzle-like resource management with authentic compiler diagnostics and step undo/redo without server latency.

## Consequences

- Instantaneous zero-latency tactic evaluation (< 5ms) and zero serverless execution costs.
- Lightweight bundle size footprint without heavy external theorem prover binaries or KaTeX dependencies.
- Fully accessible across mobile, tablet, desktop, and assistive technologies.
- Easily extensible level progression and tactic definitions with comprehensive Vitest coverage.
