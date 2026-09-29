#!/usr/bin/env node
/**
 * Vercel Hobby Storage & Build Headroom Tracker
 *
 * Tracks storage and build hour budgets, evaluates warning and critical
 * headroom thresholds, forecasts growth trends, prevents duplicate alerts,
 * and maintains an extensible free-tier provider budget ledger (Issue #698).
 *
 * Usage:
 *   npx tsx scripts/vercel-headroom.ts [--strict] [--json] [--ledger]
 */

import { getVercelRetentionInventory } from "./vercel-retention-inventory";

export type HeadroomSeverity =
  "healthy" | "warning" | "critical" | "stale" | "unreadable";

export interface MeterSample {
  resource: string;
  used: number | null;
  limit: number;
  unit: string;
  timestamp: string; // ISO 8601
  portfolioContribution?: number;
  weddingContribution?: number;
}

export interface ThresholdConfig {
  warningThresholdPercentage: number; // e.g. 80 (%)
  criticalThresholdPercentage: number; // e.g. 95 (%)
  maxSampleAgeDays: number; // e.g. 30 days
}

export interface GrowthForecast {
  status: "available" | "unknown";
  samplesAnalyzed: number;
  consumptionRatePerDay?: number;
  unit?: string;
  estimatedDaysUntilExhaustion?: number | "stable_or_contracting";
  reason?: string;
}

export interface EvaluatedMeter {
  resource: string;
  used: number | null;
  limit: number;
  unit: string;
  usagePercentage: number | null;
  headroom: number | null;
  headroomPercentage: number | null;
  severity: HeadroomSeverity;
  isStale: boolean;
  isUnreadable: boolean;
  message: string;
  growthForecast: GrowthForecast;
}

export interface HeadroomAlert {
  id: string;
  resource: string;
  severity: HeadroomSeverity;
  message: string;
  timestamp: string;
  headroomPercentage: number | null;
  isRecovery?: boolean;
}

export interface HeadroomNotificationSink {
  notify(alert: HeadroomAlert): Promise<void> | void;
}

export interface ProviderLedgerEntry {
  provider: string;
  resource: string;
  plan: string;
  freeTierLimit: string;
  observedUsage: string | number | null;
  resetWindow: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  notes: string;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  warningThresholdPercentage: 80.0,
  criticalThresholdPercentage: 95.0,
  maxSampleAgeDays: 30,
};

/**
 * Extensible multi-provider free-tier budget ledger.
 * Unavailable integration meters are recorded as unknown, NEVER zero or assumed healthy.
 */
export const FREE_TIER_BUDGET_LEDGER: ProviderLedgerEntry[] = [
  {
    provider: "Vercel",
    resource: "Functions Storage",
    plan: "Hobby",
    freeTierLimit: "10.0 GB",
    observedUsage: 9.68,
    resetWindow: "Rolling 30-day window",
    status: "critical",
    notes:
      "Critical GB-month meter; 57 approved deployments were removed under closed issue #692 and reporting is reconciling",
  },
  {
    provider: "Vercel",
    resource: "Deployment Storage",
    plan: "Hobby",
    freeTierLimit: "10.0 GB",
    observedUsage: 6.2,
    resetWindow: "Rolling 30-day window",
    status: "healthy",
    notes: "Healthy headroom (3.8 GB / 38% remaining)",
  },
  {
    provider: "Vercel",
    resource: "Build Time",
    plan: "Hobby",
    freeTierLimit: "100.0 hours",
    observedUsage: 87.0,
    resetWindow: "Rolling 30-day window",
    status: "warning",
    notes:
      "Warning threshold exceeded (87% used, 13 hours remaining); automatic non-production deployments are disabled",
  },
  {
    provider: "Vercel",
    resource: "Deployment Rate Limit",
    plan: "Hobby",
    freeTierLimit: "100 deploys/day",
    observedUsage: null,
    resetWindow: "Rolling 24-hour window",
    status: "unknown",
    notes:
      "Daily deployment rate meter unavailable via public Hobby API; unmeasured",
  },
  {
    provider: "Upstash",
    resource: "Redis Commands",
    plan: "Free",
    freeTierLimit: "10,000 commands/day",
    observedUsage: null,
    resetWindow: "Daily (resets 00:00 UTC)",
    status: "unknown",
    notes:
      "Live count requires Upstash REST console; protected by in-memory rate limiting and 1500ms timeout",
  },
  {
    provider: "Upstash",
    resource: "Redis Storage",
    plan: "Free",
    freeTierLimit: "256 MB",
    observedUsage: null,
    resetWindow: "Continuous (TTL enforced)",
    status: "unknown",
    notes:
      "Keys carry 48h TTL on queues, 60s TTL on rate limits; unmeasured live size",
  },
  {
    provider: "Neon",
    resource: "Storage",
    plan: "Free",
    freeTierLimit: "0.5 GiB",
    observedUsage: null,
    resetWindow: "Continuous",
    status: "unknown",
    notes:
      "Managed Postgres database storage; live meter checked via Neon console",
  },
  {
    provider: "Neon",
    resource: "Compute Hours",
    plan: "Free",
    freeTierLimit: "190.8 compute hours/month",
    observedUsage: null,
    resetWindow: "Monthly billing cycle",
    status: "unknown",
    notes:
      "Auto-suspends after 5 min inactivity; protected by edge ISR caching",
  },
  {
    provider: "Resend",
    resource: "Outbound Emails",
    plan: "Free",
    freeTierLimit: "100 emails/day (3,000/mo)",
    observedUsage: null,
    resetWindow: "Daily & monthly rolling",
    status: "unknown",
    notes:
      "Protected by client-side bot detection, honey-pots, and rate limiting; simulated in non-prod",
  },
  {
    provider: "Clerk",
    resource: "Monthly Active Users",
    plan: "Free",
    freeTierLimit: "10,000 MAU",
    observedUsage: null,
    resetWindow: "Monthly",
    status: "unknown",
    notes:
      "Restricted to /admin portal authorization allowlist; single-user operator footprint",
  },
  {
    provider: "Sentry",
    resource: "Error Events",
    plan: "Developer",
    freeTierLimit: "5,000 events/month",
    observedUsage: null,
    resetWindow: "Monthly",
    status: "unknown",
    notes:
      "Filtered via beforeSend to discard AbortError and benign client-side extensions",
  },
  {
    provider: "Sentry",
    resource: "Performance Spans",
    plan: "Developer",
    freeTierLimit: "10,000 spans/month",
    observedUsage: null,
    resetWindow: "Monthly",
    status: "unknown",
    notes: "Sample rate clamped to 0% in preview/dev and 5% in production",
  },
];

/**
 * Calculates growth forecast based on temporal meter samples.
 * Reports unknown when samples are insufficient (< 3 samples).
 */
export function calculateGrowthForecast(
  samples: MeterSample[],
  limit: number
): GrowthForecast {
  if (samples.length < 3) {
    return {
      status: "unknown",
      samplesAnalyzed: samples.length,
      reason: `Insufficient temporal samples (${samples.length}/3 minimum required for trend extrapolation)`,
    };
  }

  // Filter valid numeric points and sort ascending by time
  const validSamples = samples
    .filter((s) => typeof s.used === "number" && !Number.isNaN(s.used))
    .map((s) => ({
      timestampMs: new Date(s.timestamp).getTime(),
      used: s.used as number,
      unit: s.unit,
    }))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (validSamples.length < 3) {
    return {
      status: "unknown",
      samplesAnalyzed: validSamples.length,
      reason: "Insufficient non-null numeric samples for growth calculation",
    };
  }

  const first = validSamples[0];
  const last = validSamples[validSamples.length - 1];
  const timeDeltaDays =
    (last.timestampMs - first.timestampMs) / (1000 * 60 * 60 * 24);

  if (timeDeltaDays <= 0) {
    return {
      status: "unknown",
      samplesAnalyzed: validSamples.length,
      reason: "Sample timestamps are identical or non-increasing",
    };
  }

  const consumptionDelta = last.used - first.used;
  const consumptionRatePerDay = consumptionDelta / timeDeltaDays;

  if (consumptionRatePerDay <= 0) {
    return {
      status: "available",
      samplesAnalyzed: validSamples.length,
      consumptionRatePerDay: Number(consumptionRatePerDay.toFixed(3)),
      unit: first.unit,
      estimatedDaysUntilExhaustion: "stable_or_contracting",
    };
  }

  const remainingHeadroom = limit - last.used;
  const daysUntilExhaustion = Math.max(
    0,
    Math.floor(remainingHeadroom / consumptionRatePerDay)
  );

  return {
    status: "available",
    samplesAnalyzed: validSamples.length,
    consumptionRatePerDay: Number(consumptionRatePerDay.toFixed(3)),
    unit: first.unit,
    estimatedDaysUntilExhaustion: daysUntilExhaustion,
  };
}

/**
 * Evaluates an individual meter against warning and critical thresholds,
 * stale sample horizons, and provider readability requirements.
 */
export function evaluateMeter(
  sample: MeterSample,
  history: MeterSample[] = [],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
  now: Date = new Date()
): EvaluatedMeter {
  // Provider read failure / missing measurement defense
  if (
    sample.used === null ||
    typeof sample.used !== "number" ||
    Number.isNaN(sample.used)
  ) {
    return {
      resource: sample.resource,
      used: null,
      limit: sample.limit,
      unit: sample.unit,
      usagePercentage: null,
      headroom: null,
      headroomPercentage: null,
      severity: "unreadable",
      isStale: false,
      isUnreadable: true,
      message: `Provider measurement unavailable or unreadable for ${sample.resource}. Metric treated as unknown, not zero.`,
      growthForecast: {
        status: "unknown",
        samplesAnalyzed: 0,
        reason: "Metric unreadable",
      },
    };
  }

  // Stale measurement defense
  const sampleTime = new Date(sample.timestamp).getTime();
  const ageDays = (now.getTime() - sampleTime) / (1000 * 60 * 60 * 24);
  const isStale = ageDays > thresholds.maxSampleAgeDays;

  const usagePercentage = Number(
    ((sample.used / sample.limit) * 100).toFixed(1)
  );
  const headroom = Number((sample.limit - sample.used).toFixed(2));
  const headroomPercentage = Number(
    ((headroom / sample.limit) * 100).toFixed(1)
  );

  let severity: HeadroomSeverity = "healthy";
  let message = `${sample.resource} is within healthy operating bounds (${headroomPercentage}% headroom remaining).`;

  if (isStale) {
    severity = "stale";
    message = `Measurement for ${sample.resource} is stale (${Math.floor(ageDays)} days old, max allowed: ${thresholds.maxSampleAgeDays} days).`;
  } else if (usagePercentage >= thresholds.criticalThresholdPercentage) {
    severity = "critical";
    message = `CRITICAL: ${sample.resource} has reached ${usagePercentage}% usage (${headroom} ${sample.unit} / ${headroomPercentage}% headroom remaining). Immediate operator action required.`;
  } else if (usagePercentage >= thresholds.warningThresholdPercentage) {
    severity = "warning";
    message = `WARNING: ${sample.resource} has reached ${usagePercentage}% usage (${headroom} ${sample.unit} / ${headroomPercentage}% headroom remaining). Headroom approaching operational boundary.`;
  }

  const allSamples = [...history, sample];
  const growthForecast = calculateGrowthForecast(allSamples, sample.limit);

  return {
    resource: sample.resource,
    used: sample.used,
    limit: sample.limit,
    unit: sample.unit,
    usagePercentage,
    headroom,
    headroomPercentage,
    severity,
    isStale,
    isUnreadable: false,
    message,
    growthForecast,
  };
}

/**
 * Deduplicating Alert Dispatcher
 * Suppresses repetitive identical alerts within a configurable cooldown window
 * and emits recovery events when transitioning back to healthy states.
 */
export class HeadroomAlertManager {
  private cooldownMs: number;
  private sentAlertTimestamps = new Map<string, number>();
  private activeSeverityByResource = new Map<string, HeadroomSeverity>();

  constructor(cooldownMs = 3600000) {
    // default 1 hour cooldown
    this.cooldownMs = cooldownMs;
  }

  public evaluateAndDispatch(
    evaluated: EvaluatedMeter[],
    sink?: HeadroomNotificationSink,
    now: Date = new Date()
  ): HeadroomAlert[] {
    const alerts: HeadroomAlert[] = [];
    const currentTime = now.getTime();

    for (const meter of evaluated) {
      const prevSeverity =
        this.activeSeverityByResource.get(meter.resource) || "healthy";
      const currentSeverity = meter.severity;
      this.activeSeverityByResource.set(meter.resource, currentSeverity);

      // Check recovery transition (e.g. was critical/warning, now healthy)
      if (
        (prevSeverity === "critical" || prevSeverity === "warning") &&
        currentSeverity === "healthy"
      ) {
        const recoveryAlert: HeadroomAlert = {
          id: `${meter.resource}:recovery:${currentTime}`,
          resource: meter.resource,
          severity: "healthy",
          message: `RECOVERY: ${meter.resource} has returned to healthy operating bounds (${meter.headroomPercentage}% headroom remaining).`,
          timestamp: now.toISOString(),
          headroomPercentage: meter.headroomPercentage,
          isRecovery: true,
        };
        alerts.push(recoveryAlert);
        if (sink) void sink.notify(recoveryAlert);
        continue;
      }

      // Check threshold breaches (warning, critical, stale, unreadable)
      if (currentSeverity !== "healthy") {
        const fingerprint = `${meter.resource}:${currentSeverity}`;
        const lastSent = this.sentAlertTimestamps.get(fingerprint);

        if (!lastSent || currentTime - lastSent >= this.cooldownMs) {
          this.sentAlertTimestamps.set(fingerprint, currentTime);
          const alert: HeadroomAlert = {
            id: `${meter.resource}:${currentSeverity}:${currentTime}`,
            resource: meter.resource,
            severity: currentSeverity,
            message: meter.message,
            timestamp: now.toISOString(),
            headroomPercentage: meter.headroomPercentage,
          };
          alerts.push(alert);
          if (sink) void sink.notify(alert);
        }
      }
    }

    return alerts;
  }

  public clear(): void {
    this.sentAlertTimestamps.clear();
    this.activeSeverityByResource.clear();
  }
}

/**
 * In-memory notification sink for testing and non-network verification.
 */
export class MemoryNotificationSink implements HeadroomNotificationSink {
  public recordedAlerts: HeadroomAlert[] = [];

  public notify(alert: HeadroomAlert): void {
    this.recordedAlerts.push(alert);
  }

  public clear(): void {
    this.recordedAlerts = [];
  }
}

export interface HeadroomTrackerResult {
  timestamp: string;
  plan: string;
  scope: string;
  meters: {
    functionsStorage: EvaluatedMeter;
    deploymentStorage: EvaluatedMeter;
    buildTime: EvaluatedMeter;
  };
  alerts: HeadroomAlert[];
  ledger: ProviderLedgerEntry[];
  hasCriticalAlerts: boolean;
}

export interface VercelApiFetchOptions {
  token?: string;
  teamId?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Authoritative Vercel REST API Documentation, Endpoints, Schemas, & Plan Tier Limits:
 *
 * 1. Endpoints:
 *    - GET https://api.vercel.com/v2/usage (Usage Metrics API)
 *    - GET https://api.vercel.com/v6/deployments (Deployments Listing API)
 *
 * 2. Vercel Hobby Free Tier Plan Limits (Authoritative Ledger Specification):
 *    - Functions Storage: 10.0 GB (rolling 30-day window)
 *    - Deployment Storage: 10.0 GB (rolling 30-day window)
 *    - Build Time: 100.0 hours (rolling 30-day window)
 *
 * 3. Unit Normalization Rules:
 *    - Bytes -> GB: raw byte values (>10,000 or field `usedBytes`/`artifactsSize`) converted via bytes / (1024^3).
 *    - Seconds -> Hours: raw second values (>1,000 or field `usedSeconds`) converted via seconds / 3600.
 *    - Raw numeric values must pass runtime non-negative finite check (`parseFiniteNonNegativeNumber`).
 */
export function parseFiniteNonNegativeNumber(val: unknown): number | null {
  if (typeof val === "number") {
    return Number.isFinite(val) && !Number.isNaN(val) && val >= 0 ? val : null;
  }
  if (typeof val === "string" && val.trim() !== "") {
    const num = Number(val);
    return Number.isFinite(num) && !Number.isNaN(num) && num >= 0 ? num : null;
  }
  return null;
}

/**
 * Fetches real-time usage metrics from Vercel REST API usage endpoints.
 * Validates provider responses at runtime and converts units explicitly.
 * Returns null when unauthenticated, unreachable, or when responses are malformed.
 */
export async function fetchVercelLiveMetrics(
  options?: VercelApiFetchOptions
): Promise<{
  timestamp: string;
  meters: {
    functionsStorage?: MeterSample;
    deploymentStorage?: MeterSample;
    buildTime?: MeterSample;
  };
} | null> {
  const token = options?.token || process.env.VERCEL_TOKEN;
  if (!token) {
    return null;
  }

  const fetchImpl = options?.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return null;
  }

  const teamId =
    options?.teamId || process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID;

  const queryParams = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const baseUrl = "https://api.vercel.com";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const timestamp = new Date().toISOString();

    const [deploymentsRes, usageRes] = await Promise.all([
      fetchImpl(`${baseUrl}/v6/deployments${queryParams}`, {
        headers,
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
      fetchImpl(`${baseUrl}/v2/usage${queryParams}`, {
        headers,
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
    ]);

    let functionsUsed: number | null = null;
    let functionsLimit = 10.0;
    let deploymentStorageUsed: number | null = null;
    let deploymentStorageLimit = 10.0;
    let buildTimeUsed: number | null = null;
    let buildTimeLimit = 100.0;

    if (usageRes && usageRes.ok) {
      const usageData = await usageRes.json();
      if (!usageData || typeof usageData !== "object") {
        return null;
      }

      // Functions Storage extraction & unit normalization
      const rawFs =
        usageData?.functionsStorage?.used ??
        usageData?.functionsStorage?.usedBytes ??
        usageData?.functions?.storage ??
        usageData?.functionsStorage;
      const parsedFs = parseFiniteNonNegativeNumber(
        typeof rawFs === "object" && rawFs !== null ? rawFs.used : rawFs
      );
      if (parsedFs !== null) {
        // Convert bytes to GB if > 10,000
        functionsUsed =
          parsedFs > 10000 ? parsedFs / (1024 * 1024 * 1024) : parsedFs;
      }
      const parsedFsLimit = parseFiniteNonNegativeNumber(
        usageData?.functionsStorage?.limit
      );
      if (parsedFsLimit !== null) functionsLimit = parsedFsLimit;

      // Deployment Storage extraction & unit normalization
      const rawDs =
        usageData?.deploymentStorage?.used ??
        usageData?.deploymentStorage?.usedBytes ??
        usageData?.artifactsSize ??
        usageData?.deploymentStorage;
      const parsedDs = parseFiniteNonNegativeNumber(
        typeof rawDs === "object" && rawDs !== null ? rawDs.used : rawDs
      );
      if (parsedDs !== null) {
        deploymentStorageUsed =
          parsedDs > 10000 ? parsedDs / (1024 * 1024 * 1024) : parsedDs;
      }
      const parsedDsLimit = parseFiniteNonNegativeNumber(
        usageData?.deploymentStorage?.limit
      );
      if (parsedDsLimit !== null) deploymentStorageLimit = parsedDsLimit;

      // Build Time extraction & unit normalization
      const rawBt =
        usageData?.builds?.used ??
        usageData?.builds?.usedSeconds ??
        usageData?.buildTime ??
        usageData?.builds?.hours;
      const parsedBt = parseFiniteNonNegativeNumber(
        typeof rawBt === "object" && rawBt !== null ? rawBt.used : rawBt
      );
      if (parsedBt !== null) {
        // Convert seconds to hours if > 1,000
        buildTimeUsed = parsedBt > 1000 ? parsedBt / 3600 : parsedBt;
      }
      const parsedBtLimit = parseFiniteNonNegativeNumber(
        usageData?.builds?.limit
      );
      if (parsedBtLimit !== null) buildTimeLimit = parsedBtLimit;
    }

    if (deploymentsRes && deploymentsRes.ok && deploymentStorageUsed === null) {
      const deploymentsData = await deploymentsRes.json();
      if (Array.isArray(deploymentsData?.deployments)) {
        // Marker if deployment list was returned
      }
    }

    const resultMeters: {
      functionsStorage?: MeterSample;
      deploymentStorage?: MeterSample;
      buildTime?: MeterSample;
    } = {};

    if (functionsUsed !== null) {
      resultMeters.functionsStorage = {
        resource: "Functions Storage",
        used: Number(functionsUsed.toFixed(3)),
        limit: functionsLimit,
        unit: "GB",
        timestamp,
      };
    }

    if (deploymentStorageUsed !== null) {
      resultMeters.deploymentStorage = {
        resource: "Deployment Storage",
        used: Number(deploymentStorageUsed.toFixed(3)),
        limit: deploymentStorageLimit,
        unit: "GB",
        timestamp,
      };
    }

    if (buildTimeUsed !== null) {
      resultMeters.buildTime = {
        resource: "Build Time",
        used: Number(buildTimeUsed.toFixed(3)),
        limit: buildTimeLimit,
        unit: "hours",
        timestamp,
      };
    }

    if (Object.keys(resultMeters).length > 0) {
      return {
        timestamp,
        meters: resultMeters,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Main evaluation function collecting authoritative meter samples from Issue #691 inventory
 * or live Vercel REST API usage meters when provided.
 */
export function evaluateVercelHeadroom(
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
  sampleHistory: Record<string, MeterSample[]> = {},
  alertManager: HeadroomAlertManager = new HeadroomAlertManager(),
  sink?: HeadroomNotificationSink,
  evalTime: Date = new Date(),
  liveSamples?: {
    functionsStorage?: MeterSample;
    deploymentStorage?: MeterSample;
    buildTime?: MeterSample;
  } | null
): HeadroomTrackerResult {
  const inventory = getVercelRetentionInventory();

  const fsSample: MeterSample = liveSamples?.functionsStorage || {
    resource: "Functions Storage",
    used: inventory.meters.functionsStorage.used,
    limit: inventory.meters.functionsStorage.limit,
    unit: inventory.meters.functionsStorage.unit,
    timestamp: inventory.timestamp,
    portfolioContribution:
      inventory.meters.functionsStorage.portfolioContribution,
    weddingContribution: inventory.meters.functionsStorage.weddingContribution,
  };

  const dsSample: MeterSample = liveSamples?.deploymentStorage || {
    resource: "Deployment Storage",
    used: inventory.meters.deploymentStorage.used,
    limit: inventory.meters.deploymentStorage.limit,
    unit: inventory.meters.deploymentStorage.unit,
    timestamp: inventory.timestamp,
  };

  const btSample: MeterSample = liveSamples?.buildTime || {
    resource: "Build Time",
    used: inventory.meters.buildTime.used,
    limit: inventory.meters.buildTime.limit,
    unit: inventory.meters.buildTime.unit,
    timestamp: inventory.timestamp,
  };

  const evalFs = evaluateMeter(
    fsSample,
    sampleHistory["Functions Storage"] || [],
    thresholds,
    evalTime
  );
  const evalDs = evaluateMeter(
    dsSample,
    sampleHistory["Deployment Storage"] || [],
    thresholds,
    evalTime
  );
  const evalBt = evaluateMeter(
    btSample,
    sampleHistory["Build Time"] || [],
    thresholds,
    evalTime
  );

  const evaluatedList = [evalFs, evalDs, evalBt];
  const alerts = alertManager.evaluateAndDispatch(
    evaluatedList,
    sink,
    evalTime
  );
  const hasCriticalAlerts = evaluatedList.some(
    (m) => m.severity === "critical"
  );

  const allLive =
    Boolean(liveSamples?.functionsStorage) &&
    Boolean(liveSamples?.deploymentStorage) &&
    Boolean(liveSamples?.buildTime);

  const sampleTimestamp = allLive
    ? liveSamples!.functionsStorage!.timestamp
    : inventory.timestamp;

  return {
    timestamp: sampleTimestamp,
    plan: inventory.plan,
    scope: inventory.scope,
    meters: {
      functionsStorage: evalFs,
      deploymentStorage: evalDs,
      buildTime: evalBt,
    },
    alerts,
    ledger: FREE_TIER_BUDGET_LEDGER,
    hasCriticalAlerts,
  };
}

export async function runHeadroomVerification(options?: {
  strict?: boolean;
  json?: boolean;
  ledger?: boolean;
  token?: string;
  evalTime?: Date;
  fetchImpl?: typeof fetch;
}): Promise<{ success: boolean; data: HeadroomTrackerResult }> {
  const evalTime = options?.evalTime ?? new Date();
  const liveData = await fetchVercelLiveMetrics({
    token: options?.token,
    fetchImpl: options?.fetchImpl,
  });

  const result = evaluateVercelHeadroom(
    DEFAULT_THRESHOLDS,
    {},
    new HeadroomAlertManager(),
    undefined,
    evalTime,
    liveData?.meters
  );

  if (options?.json) {
    console.log(JSON.stringify(result, null, 2));
    return {
      success: !options.strict || !result.hasCriticalAlerts,
      data: result,
    };
  }

  console.log("=== Vercel Hobby Storage & Headroom Status ===");
  console.log(
    `Plan: ${result.plan} | Scope: ${result.scope} | Sample: ${result.timestamp}`
  );
  console.log("");
  console.log("EVALUATED METERS:");
  for (const meter of Object.values(result.meters)) {
    const badge =
      meter.severity === "critical"
        ? "[CRITICAL]"
        : meter.severity === "warning"
          ? "[WARNING]"
          : meter.severity === "stale"
            ? "[STALE]"
            : meter.severity === "unreadable"
              ? "[UNREADABLE]"
              : "[HEALTHY]";
    console.log(
      `• ${badge.padEnd(12)} ${meter.resource.padEnd(20)} ${meter.used}/${meter.limit} ${meter.unit} (${meter.headroomPercentage}% headroom)`
    );
  }

  console.log("");
  console.log("ACTIVE ALERTS:");
  if (result.alerts.length === 0) {
    console.log(
      "  No active alerts (all meters within healthy thresholds or alerts in cooldown)"
    );
  } else {
    for (const alert of result.alerts) {
      console.log(`  [${alert.severity.toUpperCase()}] ${alert.message}`);
    }
  }

  if (options?.ledger) {
    console.log("");
    console.log("EXTENSIBLE FREE-TIER BUDGET LEDGER:");
    for (const entry of result.ledger) {
      const usage =
        entry.observedUsage !== null ? `${entry.observedUsage}` : "UNKNOWN";
      console.log(
        `• [${entry.provider}] ${entry.resource.padEnd(22)} Limit: ${entry.freeTierLimit.padEnd(14)} Used: ${usage.padEnd(10)} Status: ${entry.status.toUpperCase()}`
      );
    }
  }

  if (options?.strict && result.hasCriticalAlerts) {
    console.error(
      "\n❌ Strict failure: One or more critical headroom thresholds are currently breached!"
    );
    return { success: false, data: result };
  }

  return { success: true, data: result };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const json = args.includes("--json");
  const ledger = args.includes("--ledger");

  runHeadroomVerification({ strict, json, ledger }).then(({ success }) => {
    if (!success) {
      process.exit(1);
    }
  });
}
