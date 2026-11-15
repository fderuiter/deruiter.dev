# 0011. Bespoke Scientific & Engineering Editorial Design System & Telemetry Architecture

Date: 2026-08-17

## Status

Accepted

## Context

Previous iterations of the portfolio used decorative effects and layouts that reduced performance and clarity:

- Falling collision beam particle simulations (`BackgroundBeamsWithCollision`) executing heavy requestAnimationFrame loops on the main thread and draining mobile GPU resources.
- Diffuse neon cyan glow filters causing visual ambiguity and sub-optimal contrast.
- Unstructured bento grids and vague bullet points that failed to communicate Frederick's domain expertise in clinical data systems (CDISC, 21 CFR Part 11), formal deductive logic engines, and embedded systems emulation.

To establish an authoritative, high-assurance digital presence suitable for Principal and Staff-level engineering leadership, the design system required a complete architectural transformation into a **Bespoke Scientific & Engineering Editorial** monograph.

## Decision

We replace generic animation tropes with a high-assurance Swiss editorial design system backed by zero-CLS Pretext typography and an interactive telemetry console:

### 1. Architectural Color & Surface Hierarchy

- **Warm Graphite Palette**: Base surfaces defined by `#0d0e11` and `#13151a`, paired with high-contrast off-white (`#f4f4f6`) for maximum typographic legibility.
- **Hairline Structural Borders**: Micro-borders (`rgba(255, 255, 255, 0.08)` / `border-zinc-800`) providing architectural structure and crisp separation.
- **Precision Semantic Accents**: Functional status indicators utilizing amber (`#f59e0b`), emerald (`#10b981`), and steel (`#94a3b8`) for AST proof verification states, regulatory conformance passes, and hardware memory meters.

### 2. Zero-CLS Hero Layout & Interactive Engineering Console

- **Split Hero Architecture**: Combines zero-CLS Pretext layout headlines with an interactive, multi-modal **Live Engineering Console** (`InteractiveEngineeringConsole`).
- **Domain Telemetry Modes**:
  - _Formal Logic Engine_: Live AST premise discharge verification indicator and rule evaluator.
  - _CDISC Clinical Architecture_: Live 21 CFR Part 11 conformance checker & audit digest.
  - _Embedded Garmin 32KB Simulator_: Realtime memory allocation meter and garbage collection monitor.
- **Contextual Studio Handoffs**: Direct routing to `/proof`, `/crf`, and `/simulator` for deep technical inspection.

### 3. Editorial Systems Dossier & Spec Index

- Replaces standard 3-card teasers with numbered engineering dossiers (`SYS-01`, `SYS-02`, `SYS-03`, `SYS-04`).
- Explicitly surfaces regulatory and computational constraints (e.g. _21 CFR Part 11 / FDA Submissions_, _Zero-Eval AST Formula Engine_, _32KB RAM Garbage Collection_).

### 4. Motion & Performance Governance

- Pure hardware-accelerated CSS transitions.
- Elimination of continuous JavaScript-driven canvas particle collision loops in favor of static composited grid accents.
- Strict WCAG 2.1 Level AA compliance with keyboard focus trapping, visible outlines, and screen reader announcements.

## Consequences

- 100/100 Lighthouse performance metrics preserved across desktop and mobile viewports.
- Significant reduction in CPU/GPU idle draw by eliminating background collision beam loops.
- Clear articulation of deep domain expertise in clinical data architecture, formal methods, and low-level systems programming.

## Editorial clarification 2026-11-14

The context describes the observed performance and layout problems. This
wording clarification leaves the design decision unchanged.
