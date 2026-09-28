# 0008. Proactive Defect Interception Strategy, Shift-Left Gateways, and Synthetic Monitoring

Date: 2026-08-15

## Status

Accepted

## Context

Complex modern web applications and computational engines require continuous deployment without risking stability or introducing user-facing regressions. Reactive bug fixing after user discovery creates customer friction, operational drag, and deploy hesitation.

To achieve continuous deployment confidence, defects must be intercepted proactively before reaching or impacting users via a unified three-pillar strategy:

1. Shift-Left automated analysis (property-based fuzzing, strict static invariants) running during CI before code merges.
2. Synthetic user probing continuously running headless user journeys and API health probes against preview, staging, and production environments.
3. Automated Canary Analysis (ACA) and anomaly detection telemetry to silently detect regressions and trigger instant rollbacks.

## Decision

We establish an end-to-end Proactive Defect Interception architecture spanning three core pillars:

### 1. Shift-Left & Automated Gateways

- **Property-Based & Fuzz Testing (`fast-check`)**: Implemented in `__tests__/property-fuzz.test.ts`, running hundreds of generative test vectors against AST parsing, formula formatting, algebraic transformations (De Morgan's laws, double negation), responsive masonry calculations, and security authentication filters.
- **Property-Based Fuzz Testing Gateway (`scripts/run-mutation-tests.ts`)**: Targets high-criticality deterministic logic modules (`lib/proof-utils.ts`, `lib/masonry.ts`, `lib/error-sanitization.ts`, `lib/security.ts`) enforcing fast-check property-based fuzz testing invariants.
- **Static Invariant Diagnostics (`lib/dx/doctor.ts`)**: Continuously verifies that all defensive boundary guards, route indexing, accessibility standards, and spec synchronizations pass without warnings.

### 2. Synthetic User Probing

- **Headless Journey Monitoring (`__tests__/e2e/synthetic-probes.spec.ts`)**: Automated Playwright probes simulating critical user journeys:
  - Landing page Pretext layout and masonry hydration without visual collapse.
  - Command Palette modal trigger (`Cmd+K`), search discovery, and keyboard navigation.
  - Formal Proof Assistant DAG deduction step insertion, graph node connection, and multi-format export.
  - Arcade 2D/3D canvas context initialization and state transitions.
  - Telemetry API ingestion, strict schema rejection on malformed inputs, and rate limit compliance.
- **Scheduled Continuous Execution (`.github/workflows/synthetic-probes.yml`)**: Executes headless synthetic probes on a daily cron schedule (`17 7 * * *`) plus manual `workflow_dispatch` triggers. The interval is deliberately daily: a `*/30` cadence consumed roughly 144% of the private-repo free Actions allowance.

### 3. Canary Telemetry, Anomaly Detection & Automated Rollback

- **Automated Canary Analysis (`scripts/canary-analyzer.ts`)**: Evaluates live telemetry metrics across canary rollout windows against baseline error budgets:
  - HTTP 5xx Server Error Rate: Hard safety limit of <= 0.5% (0.005).
  - Latency SLA: p95 response time <= 800ms, and relative latency regression <= 25% vs baseline.
  - Sentry Unhandled Exceptions: Spike ratio <= 2.0x baseline.
- **Automated Rollback Dispatch (`executeAutomatedRollback`)**: Automatically prepares and dispatches rollback payloads to hosting infrastructure (Vercel deployment rollbacks / webhook alerts) when canary evaluation status is `ROLLBACK_REQUIRED`.

## Invariant Compliance

- **AGENTS.md Invariant 1 (Test Path Resolution)**: Dynamic root path resolution in all probe runners and scripts.
- **AGENTS.md Invariant 6 (Developer Suite & Quality)**: Integrated into `npm run dx doctor`, `npm run verify`, and `npm run quality`.
- **AGENTS.md Invariant 12 (Proactive Defect Interception & Synthetic Reliability)**: Enforces active property fuzzing gates, fast-check property suites, synthetic journey probes, and canary analysis scripts.

## Amendment 2026-09-25: Canary Analysis Is Manual Tooling

Pillar 3 was never wired into a deployment. `scripts/canary-analyzer.ts` is
invoked only by its tests and by `npm run canary:eval`, which evaluates
built-in sample metrics. No workflow, build step or Vercel integration feeds
it live telemetry, and `executeAutomatedRollback` has no caller.
[ADR 0049](0049-deploy-main-on-green-ci.md) records the automatic production
trigger now superseded by [ADR 0051](0051-manual-production-releases.md).
During the hold, an operator starts the production build from the Vercel
Dashboard after Merge Gate passes, with a Vercel Deployment Check before
domains move. Keep the hold until a replacement release policy is approved
and verified. Rollback remains a person using Vercel's Instant Rollback.

The analyzer stays as manual tooling for judging a deploy from metrics a
person supplies. Automating promotion or rollback would need a new ADR
covering a separately authenticated Vercel control-plane integration, a live
metrics source, idempotency and audit logging, without placing a Vercel token
in ordinary GitHub CI. See `DEPLOYMENT.md` section 2 and issue #987.
