#!/usr/bin/env node
/**
 * Canary analysis: manual tooling, not a deployment gate.
 * Evaluates caller-supplied canary and baseline metric windows against error
 * budgets, latency SLOs and Sentry exception rates. Nothing invokes it
 * automatically and it has no live metrics source; `npm run canary:eval` runs
 * it on built-in sample data. Production rollback is a person using Vercel's
 * Instant Rollback (ADR 0049, DEPLOYMENT.md section 2).
 */

export interface TelemetryMetrics {
  totalRequests: number;
  serverErrors5xx: number;
  p95LatencyMs: number;
  p99LatencyMs?: number;
  sentryExceptionCount: number;
  windowDurationMinutes?: number;
}

export const DEFAULT_CANARY_WINDOW_MINUTES = 15;
export const DEFAULT_BASELINE_WINDOW_MINUTES = 60;

export interface CanaryAnalysisThresholds {
  maxErrorRate: number; // Max allowed 5xx error rate (default: 0.005 = 0.5%)
  maxLatencyP95Ms: number; // Max allowed p95 latency in ms (default: 800ms)
  maxLatencyRegressionPct: number; // Max allowed latency increase vs baseline (default: 25%)
  maxExceptionSpikeRatio: number; // Max allowed Sentry exception spike vs baseline (default: 2.0x)
}

export const DEFAULT_THRESHOLDS: CanaryAnalysisThresholds = {
  maxErrorRate: 0.005, // 0.5%
  maxLatencyP95Ms: 800, // 800ms
  maxLatencyRegressionPct: 25, // 25%
  maxExceptionSpikeRatio: 2.0, // 2x
};

export type CanaryDecision = "HEALTHY" | "DEGRADED" | "ROLLBACK_REQUIRED";

export interface CanaryEvaluationResult {
  decision: CanaryDecision;
  reasons: string[];
  canaryMetrics: {
    errorRate: number;
    errorRatePct: string;
    p95LatencyMs: number;
    sentryExceptionCount: number;
    exceptionRatePerMinute: number;
  };
  baselineMetrics?: {
    errorRate: number;
    errorRatePct: string;
    p95LatencyMs: number;
    sentryExceptionCount: number;
    exceptionRatePerMinute: number;
  };
  metricsComparison: {
    latencyDeltaMs: number;
    latencyDeltaPct: number;
    errorRateDelta: number;
    exceptionRatio: number;
  };
  rollbackTriggered: boolean;
  timestamp: string;
}

function getWindowDuration(
  duration?: number,
  defaultDuration: number = 15
): number {
  return typeof duration === "number" && duration > 0
    ? duration
    : defaultDuration;
}

/**
 * Evaluates canary rollout telemetry against baseline and thresholds.
 */
export function evaluateCanaryRollout(
  canary: TelemetryMetrics,
  baseline?: TelemetryMetrics,
  customThresholds?: Partial<CanaryAnalysisThresholds>
): CanaryEvaluationResult {
  const thresholds: CanaryAnalysisThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...customThresholds,
  };

  const reasons: string[] = [];
  const canaryErrorRate =
    canary.totalRequests > 0
      ? canary.serverErrors5xx / canary.totalRequests
      : 0;
  const baselineErrorRate =
    baseline && baseline.totalRequests > 0
      ? baseline.serverErrors5xx / baseline.totalRequests
      : 0;

  const canaryDuration = getWindowDuration(
    canary.windowDurationMinutes,
    DEFAULT_CANARY_WINDOW_MINUTES
  );
  const baselineDuration = baseline
    ? getWindowDuration(
        baseline.windowDurationMinutes,
        DEFAULT_BASELINE_WINDOW_MINUTES
      )
    : DEFAULT_BASELINE_WINDOW_MINUTES;

  const canaryExceptionRate = canary.sentryExceptionCount / canaryDuration;
  const baselineExceptionRate = baseline
    ? baseline.sentryExceptionCount / baselineDuration
    : 0;

  const latencyDeltaMs = baseline
    ? canary.p95LatencyMs - baseline.p95LatencyMs
    : 0;
  const latencyDeltaPct =
    baseline && baseline.p95LatencyMs > 0
      ? ((canary.p95LatencyMs - baseline.p95LatencyMs) /
          baseline.p95LatencyMs) *
        100
      : 0;

  const errorRateDelta = canaryErrorRate - baselineErrorRate;
  const exceptionRatio =
    baseline && baselineExceptionRate > 0
      ? canaryExceptionRate / baselineExceptionRate
      : canaryExceptionRate > 0
        ? Infinity
        : 1.0;

  let decision: CanaryDecision = "HEALTHY";

  // 1. Critical 5xx Error Rate Check
  if (canaryErrorRate > thresholds.maxErrorRate) {
    decision = "ROLLBACK_REQUIRED";
    reasons.push(
      `CRITICAL: Canary 5xx error rate (${(canaryErrorRate * 100).toFixed(2)}%) exceeds safety budget threshold (${(thresholds.maxErrorRate * 100).toFixed(2)}%).`
    );
  }

  // 2. Critical Sentry Exception Spike Check
  if (
    canary.sentryExceptionCount > 0 &&
    exceptionRatio > thresholds.maxExceptionSpikeRatio
  ) {
    decision = "ROLLBACK_REQUIRED";
    reasons.push(
      `CRITICAL: Sentry exception count spiked by ${exceptionRatio === Infinity ? "infinity (new errors)" : `${exceptionRatio.toFixed(1)}x`} vs baseline (threshold: ${thresholds.maxExceptionSpikeRatio}x).`
    );
  }

  // 3. Latency Regression & SLA Checks
  if (canary.p95LatencyMs > thresholds.maxLatencyP95Ms) {
    if (decision !== "ROLLBACK_REQUIRED") {
      decision = "ROLLBACK_REQUIRED";
    }
    reasons.push(
      `CRITICAL: p95 latency (${canary.p95LatencyMs}ms) breached hard latency SLA (${thresholds.maxLatencyP95Ms}ms).`
    );
  } else if (latencyDeltaPct > thresholds.maxLatencyRegressionPct) {
    if (decision === "HEALTHY") {
      decision = "DEGRADED";
    }
    reasons.push(
      `WARNING: p95 latency increased by ${latencyDeltaPct.toFixed(1)}% vs baseline (threshold: ${thresholds.maxLatencyRegressionPct}%).`
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "All canary telemetry signals within normal bounds and error budgets."
    );
  }

  return {
    decision,
    reasons,
    canaryMetrics: {
      errorRate: canaryErrorRate,
      errorRatePct: `${(canaryErrorRate * 100).toFixed(2)}%`,
      p95LatencyMs: canary.p95LatencyMs,
      sentryExceptionCount: canary.sentryExceptionCount,
      exceptionRatePerMinute: canaryExceptionRate,
    },
    baselineMetrics: baseline
      ? {
          errorRate: baselineErrorRate,
          errorRatePct: `${(baselineErrorRate * 100).toFixed(2)}%`,
          p95LatencyMs: baseline.p95LatencyMs,
          sentryExceptionCount: baseline.sentryExceptionCount,
          exceptionRatePerMinute: baselineExceptionRate,
        }
      : undefined,
    metricsComparison: {
      latencyDeltaMs,
      latencyDeltaPct,
      errorRateDelta,
      exceptionRatio: exceptionRatio === Infinity ? 999 : exceptionRatio,
    },
    rollbackTriggered: decision === "ROLLBACK_REQUIRED",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Dispatches automated rollback action if required.
 */
export async function executeAutomatedRollback(
  result: CanaryEvaluationResult,
  options: { dryRun?: boolean; webhookUrl?: string } = {}
): Promise<{ success: boolean; message: string }> {
  if (result.decision !== "ROLLBACK_REQUIRED") {
    return { success: true, message: "Rollout healthy, no rollback required." };
  }

  const payload = {
    event: "AUTOMATED_CANARY_ROLLBACK",
    timestamp: result.timestamp,
    reasons: result.reasons,
    metrics: result.canaryMetrics,
  };

  if (options.dryRun || !options.webhookUrl) {
    return {
      success: true,
      message: `[DRY RUN] Automated rollback payload prepared: ${JSON.stringify(payload)}`,
    };
  }

  try {
    const res = await fetch(options.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return {
      success: res.ok,
      message: res.ok
        ? "Rollback webhook dispatched successfully."
        : `Webhook failed with status ${res.status}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to trigger rollback webhook: ${errorMsg}`,
    };
  }
}

// CLI Execution Entry Point
if (require.main === module) {
  const sampleCanary: TelemetryMetrics = {
    totalRequests: 25000,
    serverErrors5xx: 12,
    p95LatencyMs: 140,
    sentryExceptionCount: 0,
    windowDurationMinutes: 15,
  };

  const sampleBaseline: TelemetryMetrics = {
    totalRequests: 50000,
    serverErrors5xx: 10,
    p95LatencyMs: 135,
    sentryExceptionCount: 0,
    windowDurationMinutes: 60,
  };

  console.log("\n🐥 Running canary analysis on built-in sample metrics...");
  const evaluation = evaluateCanaryRollout(sampleCanary, sampleBaseline);
  console.log(`Status: [${evaluation.decision}]`);
  for (const reason of evaluation.reasons) {
    console.log(`  • ${reason}`);
  }
  console.log(`\nMetrics Summary:`);
  console.log(`  Canary Error Rate: ${evaluation.canaryMetrics.errorRatePct}`);
  console.log(`  p95 Latency: ${evaluation.canaryMetrics.p95LatencyMs}ms`);
  console.log(
    `  Sentry Exceptions: ${evaluation.canaryMetrics.sentryExceptionCount} (${evaluation.canaryMetrics.exceptionRatePerMinute.toFixed(2)}/min)`
  );
  console.log("");
}
