# Production Deployment, Rollback & Synthetic Monitoring

During the manual hold, a person starts each Production deployment from the
Vercel Dashboard after CI passes ([ADR 0051](adr/0051-manual-production-releases.md)).
Keep the hold until a replacement release policy is approved and verified.
The nightly-train proposal is tracked in
[issue #1168](https://github.com/fderuiter/deruiter.dev/issues/1168). The canonical, step-by-step release procedure is
[`docs/how-to/release-and-deploy.md`](docs/how-to/release-and-deploy.md). This
guide describes the controls around that flow, the manual canary-analysis
tooling, and the triage runbooks for the scheduled synthetic probes.

---

## 1. The Controls That Actually Guard Production

| Stage                     | Control                                                                                                                | Where it lives                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Before merge              | **Merge Gate (Required Checks Summary)** must be green on the PR                                                       | `.github/workflows/ci.yml`               |
| After green merge         | An operator uses Dashboard → Deployments → Create Deployment with the current `main` SHA; GitHub Actions never deploys | Vercel project, `vercel.json`, ADR 0051  |
| During the build          | Pending migrations are applied through the unpooled Neon endpoint on Vercel production builds only, before compilation | `scripts/build.js`                       |
| Before promotion          | A Vercel **Deployment Check** holds the domains until Merge Gate passes on that commit                                 | Vercel project settings                  |
| After promotion           | The daily synthetic probes exercise the critical journeys against production (section 3)                               | `.github/workflows/synthetic-probes.yml` |
| When production is broken | A person uses Vercel's **Instant Rollback** to the previous production deployment, then fixes forward with a PR        | Vercel dashboard                         |

Nothing in this repository promotes or rolls back a deployment automatically.

---

## 2. Canary Analysis Tooling (Manual)

`scripts/canary-analyzer.ts` is a library and a manual command. **No workflow,
build step, cron or Vercel integration invokes it**, and it has no source of
live production metrics. Its verdicts are advice for a person deciding whether
to use Instant Rollback.

### Commands and Entry Points

- **Demo run**: `npm run canary:eval` (or `npx tsx scripts/canary-analyzer.ts`)
  evaluates a built-in sample pair of metric windows and prints the verdict.
  It does not read production data.
- **Library**: `evaluateCanaryRollout(canary, baseline, customThresholds)`
  compares two `TelemetryMetrics` windows that the caller supplies, for
  example numbers copied from Vercel Observability and Sentry for the
  15 minutes after a deploy and the preceding hour.

### Evaluation Window Parameters

- **Canary Window**: Default 15 minutes (`DEFAULT_CANARY_WINDOW_MINUTES = 15`).
- **Baseline Window**: Default 60 minutes (`DEFAULT_BASELINE_WINDOW_MINUTES = 60`).

### Canary Decision States

1. **`HEALTHY`**: Error rate, p95 latency and Sentry exception rate are within the thresholds below.
2. **`DEGRADED`**: p95 latency rose by more than 25% against the baseline but stays under the 800ms ceiling. Review before doing anything else.
3. **`ROLLBACK_REQUIRED`**: A hard threshold was breached. Use Vercel's Instant Rollback, then fix forward.

### Thresholds

The defaults live in `DEFAULT_THRESHOLDS` (`scripts/canary-analyzer.ts`):

| SLA Metric                      | Threshold Parameter       | Default Limit      | Evaluation Condition                                | Result State        |
| ------------------------------- | ------------------------- | ------------------ | --------------------------------------------------- | ------------------- |
| **5xx Error Rate**              | `maxErrorRate`            | **0.5%** (`0.005`) | `canaryErrorRate > 0.005`                           | `ROLLBACK_REQUIRED` |
| **p95 Latency Ceiling**         | `maxLatencyP95Ms`         | **800ms**          | `canary.p95LatencyMs > 800`                         | `ROLLBACK_REQUIRED` |
| **Relative Latency Regression** | `maxLatencyRegressionPct` | **25%**            | `latencyDeltaPct > 25%` (when p95 <= 800ms)         | `DEGRADED`          |
| **Exception Spike Ratio**       | `maxExceptionSpikeRatio`  | **2.0x**           | `canaryExceptionRate / baselineExceptionRate > 2.0` | `ROLLBACK_REQUIRED` |

- **5xx error rate**: `serverErrors5xx / totalRequests`.
- **Relative latency regression**: `((canary.p95LatencyMs - baseline.p95LatencyMs) / baseline.p95LatencyMs) * 100`.
- **Exception spike ratio**: exceptions are normalized per minute of each window, so windows of different lengths compare fairly. New exceptions against a zero baseline count as a spike.

### `executeAutomatedRollback` (Unwired Webhook Helper)

`executeAutomatedRollback(result, { dryRun, webhookUrl })` builds an
`AUTOMATED_CANARY_ROLLBACK` JSON payload. It posts that payload only when a
caller passes a `webhookUrl`, and no caller does; with `dryRun` or no URL it
only logs the payload. It cannot roll back a Vercel deployment by itself.
Automating rollback would need a separately authenticated Vercel control-plane
integration, a live metrics source, idempotency and an audit log, and it must
not put a Vercel token in ordinary GitHub CI. None of that exists today.

---

## 3. Scheduled Synthetic Probe Monitoring

To catch silent production regressions, the repository runs automated, continuous end-to-end Playwright synthetic probes.

### Daily Cron Schedule

- **Workflow File**: `.github/workflows/synthetic-probes.yml`
- **Cron Schedule**: `17 7 * * *` (runs daily at 07:17 UTC)
- **Runtime Environment**: Headless Chromium on `ubuntu-latest`, Node.js 24.x,
  using cached Playwright binaries.

### Manual Probe Execution & Custom Target URLs

Engineers can manually trigger synthetic probes locally or against preview/staging deployments using target URL overrides.

- **Local / Default Production Execution**:

  ```bash
  npm run probe:synthetic
  ```

  Or directly via Playwright:

  ```bash
  npx playwright test __tests__/e2e/synthetic-probes.spec.ts --project=chromium
  ```

- **Execution Against Custom Target URL (Preview / Staging)**:
  Set `PLAYWRIGHT_TEST_BASE_URL` environment variable before running the test:

  ```bash
  PLAYWRIGHT_TEST_BASE_URL="https://portfolio-preview-git-feature.vercel.app" npm run probe:synthetic
  ```

- **Manual GitHub Actions Dispatch**:
  Trigger via GitHub CLI with optional `target_url` parameter:
  ```bash
  gh workflow run synthetic-probes.yml -f target_url="https://portfolio-preview-git-feature.vercel.app"
  ```

---

## 4. Synthetic Probe Failure Triage Runbooks

When a synthetic probe alert triggers, on-call engineers should follow the dedicated triage runbook for the failing journey. Triage should be completed within 10 minutes.

### Runbook 1: Landing Page & Pretext Layout Journey

- **Probe ID**: Probe 1 (`__tests__/e2e/synthetic-probes.spec.ts`)
- **Covered Capabilities**: Main container (`#main-content`), bento grid card rendering, Pretext DOM-free text layout engine, dynamic card height calculations (`box.height > 50`, `box.width > 100`).
- **Failure Symptoms**: `Probe 1` fails due to missing `#main-content`, zero-height bento cards, or DOM reflow crashes.
- **Triage Steps**:
  1. **Run Isolated Probe**:
     ```bash
     PLAYWRIGHT_TEST_BASE_URL="<TARGET_URL>" npx playwright test __tests__/e2e/synthetic-probes.spec.ts -g "Probe 1"
     ```
  2. **Inspect Pretext Canvas Measurement Context**: Verify that `@chenglou/pretext` initialized cleanly without SSR Canvas `measureText` exceptions.
  3. **Check Container Bounds**: Verify that root container `app/layout.tsx` and `app/page.tsx` maintain `#main-content` landmark and flex/grid layout constraints (`min-w-0`).
  4. **Verify CSS & Font Loading**: Confirm Tailwind CSS v4 `@import "tailwindcss";` and Inter font variable `--font-inter` loaded without network stalls.

### Runbook 2: Command Palette Discovery & Navigation Journey

- **Probe ID**: Probe 2 (`__tests__/e2e/synthetic-probes.spec.ts`)
- **Covered Capabilities**: Command Palette trigger buttons (Desktop `Search portfolio and commands (Press Command+K)` / Mobile `Open Command Search`), dialog modal (`getByRole("dialog", { name: /Command Palette/i })`), fuzzy keyword filtering, and instant navigation to `/proof`.
- **Failure Symptoms**: Command Palette dialog fails to open within hydration retry timeout (15s), query input fails to capture text, or `/proof` route transition fails.
- **Triage Steps**:
  1. **Run Isolated Probe**:
     ```bash
     PLAYWRIGHT_TEST_BASE_URL="<TARGET_URL>" npx playwright test __tests__/e2e/synthetic-probes.spec.ts -g "Probe 2"
     ```
  2. **Verify React 19 Hydration**: Confirm that interactive search buttons are wrapped in hydration polling blocks (`expect(...).toPass({ timeout: 15000 })`) and event listeners have attached.
  3. **Inspect Case Studies API Endpoint**: Verify that `GET /api/case-studies` responds with `200 OK` and valid JSON array:
     ```bash
     curl -i <TARGET_URL>/api/case-studies
     ```
  4. **Check Focus Trap & Portal**: Verify `components/CommandPalette.tsx` body scroll lock (`overflow = hidden`) and React Portal mounting.

### Runbook 3: Proof Assistant DAG Engine & Export Journey

- **Probe ID**: Probe 3 (`__tests__/e2e/synthetic-probes.spec.ts`)
- **Covered Capabilities**: Deductive proof workspace (`/proof`), formal verification header, AST deduction graph nodes, Rule Palette, and Export dialog (`Export|Share Proof`).
- **Failure Symptoms**: `/proof` route crashes on render, proof graph nodes fail to mount, or Export modal fails to render or close cleanly.
- **Triage Steps**:
  1. **Run Isolated Probe**:
     ```bash
     PLAYWRIGHT_TEST_BASE_URL="<TARGET_URL>" npx playwright test __tests__/e2e/synthetic-probes.spec.ts -g "Probe 3"
     ```
  2. **Verify AST Evaluator Engine**: Run unit test suite to rule out cycle detection or stack overflow in propositional AST evaluator (`lib/proof-utils.ts`):
     ```bash
     npm test __tests__/proof-engine.test.ts
     ```
  3. **Check WebGL / SVG Canvas Errors**: Inspect browser console for Framer Motion animation or SVG rendering errors on the graph canvas.
  4. **Validate Export Dialog**: Ensure `ModalContainer` trapped focus restored properly on `Escape` key press.

### Runbook 4: Arcade Canvas 2D Engine Journey

- **Probe ID**: Probe 4 (`__tests__/e2e/synthetic-probes.spec.ts`)
- **Covered Capabilities**: Game cabinet route (`/arcade/laser-loon`), `Launch Cabinet` trigger button interaction, HTML5 `<canvas>` element mounting, and 2D rendering loop initialization.
- **Failure Symptoms**: `Launch Cabinet` button unclickable, `<canvas>` element fails to mount within 20s, or graphics context creation throws unhandled errors.
- **Triage Steps**:
  1. **Run Isolated Probe**:
     ```bash
     PLAYWRIGHT_TEST_BASE_URL="<TARGET_URL>" npx playwright test __tests__/e2e/synthetic-probes.spec.ts -g "Probe 4"
     ```
  2. **Inspect Cabinet Launch Workflow**: Verify that `<PlayCabinet>` launch button `Launch Cabinet` receives click events after CRT monitor warmup.
  3. **Verify Canvas 2D Context Support**: Ensure headless browser has hardware acceleration or software WebGL/Canvas 2D fallbacks enabled (`vitest.setup.ts` canvas stubs).
  4. **Check Web Audio Synthesizer**: Verify that Web Audio API initialization in `components/arcade/ControlDocks.tsx` handles `hover: none` touch environments defensively.

### Runbook 5: API Ingestion, Schema Guard & Rate Limiting Journey

- **Probe ID**: Probe 5 (`__tests__/e2e/synthetic-probes.spec.ts`)
- **Covered Capabilities**: Telemetry API (`/api/telemetry`), Case Studies API (`/api/case-studies`), Zod schema validation guard (`lib/schemas.ts`), and sliding-window rate limiter.
- **Failure Symptoms**: Valid telemetry POST fails with status != 200/201, invalid telemetry POST fails to reject with HTTP 400, or case studies GET fails.
- **Triage Steps**:
  1. **Run Isolated Probe**:
     ```bash
     PLAYWRIGHT_TEST_BASE_URL="<TARGET_URL>" npx playwright test __tests__/e2e/synthetic-probes.spec.ts -g "Probe 5"
     ```
  2. **Test Valid Telemetry Ingestion Manually**:
     ```bash
     curl -i -X POST <TARGET_URL>/api/telemetry \
       -H "Content-Type: application/json" \
       -d '{"eventType":"page_view","projectSlug":"triage-probe"}'
     ```
     Verify HTTP status `201` (buffered) or `202` (accepted but dropped) and
     response `{ "success": true }`. The route never returns `200`.
  3. **Test Schema Guard Rejection**:
     ```bash
     curl -i -X POST <TARGET_URL>/api/telemetry \
       -H "Content-Type: application/json" \
       -d '{"projectSlug":"malformed-payload"}'
     ```
     Verify HTTP status `400 Bad Request` and JSON error details.
  4. **Inspect Database & Redis Rate Limiter**: Check Neon PostgreSQL connection string (`DATABASE_URL`) and Upstash Redis rate limiting headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).

### Runbook 6: Warm Service Worker Arcade Navigation

- **Probe ID**: Probe 6 (`__tests__/e2e/synthetic-probes.spec.ts`)
- **Covered Capabilities**: Service-worker installation and activation, controlled
  navigation to `/arcade/working-with-duck`, truthful fallback messaging, and the
  `<PlayCabinet>` canvas launch workflow.
- **Failure Symptoms**: The worker never controls the page, the arcade navigation
  serves the offline recovery view while online, or the game canvas does not mount.
- **Triage Steps**:
  1. **Run the isolated probe against the intended deployment**:
     ```bash
     PLAYWRIGHT_TEST_BASE_URL="<TARGET_URL>" npx playwright test __tests__/e2e/synthetic-probes.spec.ts -g "Probe 6" --project=chromium
     ```
  2. **Inspect the deployed worker**: Confirm `/sw.js` contains the current
     release's public route catalog and that the browser reports an active
     controller after reload.
  3. **Remove stale-worker ambiguity**: Test once in a fresh browser profile and
     once after allowing the existing registration to update. A fresh-profile
     pass with an upgrade-profile failure indicates an activation or cache
     migration regression.
  4. **Verify the response truthfully**: A real connectivity failure may render
     the offline recovery view. An online navigation failure must identify the
     page as unavailable and offer retry without claiming the visitor is offline.
