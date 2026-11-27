# 0007. Comprehensive Defect Remediation Strategy and Root-Cause Invariant Gate

Date: 2026-08-15

## Status

Accepted

## Context

Complex interactive engines across the portfolio—including formal logic proof solvers (`lib/proof-utils.ts`), 21 CFR Part 11 CRF clinical calculations (`lib/crf/ast-evaluator.ts`), Garmin watch telemetry simulations (`lib/garmin-engine.ts`), and 60FPS deterministic game loops (`lib/working-with-duck-engine.ts`)—contain intricate state machines and mathematical evaluation graphs.

Without a systematic, multi-layered defect eradication strategy:

1. Corner cases such as division-by-zero, cyclic graph references, deep AST recursion overflows, and floating-point drift can lead to latent runtime crashes or corrupted outputs.
2. Defect fixes may treat surface symptoms rather than eliminating root architectural flaws, risking regression drift when adjacent code paths mutate.
3. Legacy modules may accumulate technical debt when bug fixes lack automated reproduction regression tests and invariant verification gates in CI.

## Decision

We establish an end-to-end Defect Remediation and Quality Engineering Framework:

### 1. Multi-Layer Defect Detection Pipeline

- **Static AST & Structural Analysis**: Static code invariants in the DX Doctor engine (`lib/dx/doctor.ts`) continuously inspect codebase modules for unguarded arithmetic operations, unsafe recursive AST evaluations, and unhandled Promise rejections.
- **Runtime Observability & Error Sanitization**: Sentry instrumentation (`instrumentation.ts`, `sentry.*.config.ts`) paired with production error scrubbing (`lib/error-sanitization.ts`) captures anomalies while preventing sensitive system path leakage.
- **Targeted Fuzzing & Boundary Stress Testing**: Automated property and boundary tests assert engine resilience across extreme inputs, zero-divisor values, out-of-bounds coordinates, and cyclic graphs.

### 2. Risk & Impact Triage Matrix (P0 - P3)

- **P0 (Critical / Blocker)**: System crash, memory corruption, unhandled exceptions, or data loss. Requires immediate root-cause eradication.
- **P1 (High / Invariant Violation)**: Calculation errors, AST logic failures, or state machine divergence. Requires formal mathematical proof and reproduction test.
- **P2 (Medium / User Experience)**: Visual layout drift, canvas rendering glitches, or accessibility navigation regressions.
- **P3 (Low / Cosmetic)**: Minor formatting, documentation typo, or non-blocking console notices.

### 3. Strict Red-Green Remediation Protocol

- **Reproduction First**: Every bug fix must begin with an isolated failing test in `__tests__/` that reproduces the exact defect and fails before code changes.
- **Root-Cause Architectural Fix**: The implementation must resolve the structural deficiency (e.g. adding strict AST depth limits, division guards, or state isolation) rather than masking symptoms.
- **Regression Patch Verification**: The fix is only complete when the reproduction test turns green alongside the full regression test suite (`__tests__/defect-remediation-regression.test.ts`).

### 4. DX Doctor Invariant Gate (Invariant #11)

- **Automated Verification**: Integrated into `scripts/dx.ts` (`npm run verify` and `npm run quality`), checking that all core computational engines satisfy boundary defenses, error sanitization, and regression test presence.
- **Auto-Remediation Support**: Non-breaking discrepancies can be inspected and auto-synchronized via `npm run doctor:fix`.

## Invariant Compliance

- **AGENTS.md Invariant 1 (Test Isolation & Paths)**: Reproduction tests use dynamic path resolution.
- **AGENTS.md Invariant 6 (DX & Quality)**: Full verification across `npm run verify` and `npm run quality`.
- **AGENTS.md Invariant 11 (Defect Remediation & Root-Cause Regression Invariant)**: Enforces 100% pass rate on regression test suites and zero unguarded calculation vectors.

## Consequences

### Positive

- Proactively eliminates latent defects in high-complexity legacy modules before release.
- Prevents regression drift through permanent, automated reproduction suites.
- Unifies quality standards across formal methods, clinical calculations, telemetry engines, and game loops.
- Provides high confidence to ship rapid architectural refactors.

### Negative / Trade-offs

- Mandates authoring reproduction tests for all bug fixes, slightly increasing initial development time per patch.
- Requires maintenance of test fixtures and boundary generators as engine capabilities expand.
