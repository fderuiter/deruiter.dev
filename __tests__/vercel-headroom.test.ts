import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateMeter,
  calculateGrowthForecast,
  HeadroomAlertManager,
  MemoryNotificationSink,
  evaluateVercelHeadroom,
  runHeadroomVerification,
  fetchVercelLiveMetrics,
  DEFAULT_THRESHOLDS,
  FREE_TIER_BUDGET_LEDGER,
  type MeterSample,
} from "../scripts/vercel-headroom";

describe("Vercel Hobby Storage & Build Headroom Tracker", () => {
  const root = path.resolve(__dirname, "..");
  const howToPath = path.join(
    root,
    "docs",
    "how-to",
    "monitor-vercel-headroom.md"
  );

  describe("1. Threshold Evaluation & Operating Boundaries", () => {
    const fixedNow = new Date("2026-09-12T18:00:00.000Z");

    it("evaluates healthy usage below warning threshold", () => {
      const sample: MeterSample = {
        resource: "Deployment Storage",
        used: 5.85,
        limit: 10.0,
        unit: "GB",
        timestamp: "2026-09-12T18:00:00.000Z",
      };

      const result = evaluateMeter(sample, [], DEFAULT_THRESHOLDS, fixedNow);
      expect(result.severity).toBe("healthy");
      expect(result.usagePercentage).toBe(58.5);
      expect(result.headroom).toBeCloseTo(4.15);
      expect(result.headroomPercentage).toBe(41.5);
      expect(result.isStale).toBe(false);
      expect(result.isUnreadable).toBe(false);
    });

    it("evaluates warning status when usage is between 80% and 95%", () => {
      const sample: MeterSample = {
        resource: "Build Time",
        used: 86.0,
        limit: 100.0,
        unit: "hours",
        timestamp: "2026-09-12T18:00:00.000Z",
      };

      const result = evaluateMeter(sample, [], DEFAULT_THRESHOLDS, fixedNow);
      expect(result.severity).toBe("warning");
      expect(result.usagePercentage).toBe(86.0);
      expect(result.headroom).toBe(14.0);
      expect(result.headroomPercentage).toBe(14.0);
      expect(result.message).toContain("WARNING");
    });

    it("evaluates critical status when usage reaches or exceeds 95%", () => {
      const sample: MeterSample = {
        resource: "Functions Storage",
        used: 9.6,
        limit: 10.0,
        unit: "GB",
        timestamp: "2026-09-12T18:00:00.000Z",
      };

      const result = evaluateMeter(sample, [], DEFAULT_THRESHOLDS, fixedNow);
      expect(result.severity).toBe("critical");
      expect(result.usagePercentage).toBe(96.0);
      expect(result.headroom).toBeCloseTo(0.4);
      expect(result.headroomPercentage).toBe(4.0);
      expect(result.message).toContain("CRITICAL");
    });
  });

  describe("2. Stale & Missing Data Defenses", () => {
    const fixedNow = new Date("2026-09-12T18:00:00.000Z");

    it("flags measurements older than 30 days as stale rather than reporting zero or healthy", () => {
      const staleSample: MeterSample = {
        resource: "Functions Storage",
        used: 5.0,
        limit: 10.0,
        unit: "GB",
        timestamp: "2026-07-01T00:00:00.000Z", // ~73 days old
      };

      const result = evaluateMeter(
        staleSample,
        [],
        DEFAULT_THRESHOLDS,
        fixedNow
      );
      expect(result.severity).toBe("stale");
      expect(result.isStale).toBe(true);
      expect(result.message).toContain("stale");
    });

    it("distinguishes provider read failure and missing data from zero usage", () => {
      const missingSample: MeterSample = {
        resource: "Functions Storage",
        used: null,
        limit: 10.0,
        unit: "GB",
        timestamp: "2026-09-12T18:00:00.000Z",
      };

      const result = evaluateMeter(
        missingSample,
        [],
        DEFAULT_THRESHOLDS,
        fixedNow
      );
      expect(result.severity).toBe("unreadable");
      expect(result.isUnreadable).toBe(true);
      expect(result.used).toBeNull();
      expect(result.headroom).toBeNull();
      expect(result.headroomPercentage).toBeNull();
      expect(result.message).toContain("unavailable or unreadable");
    });
  });

  describe("3. Growth Forecasting Engine", () => {
    it("reports forecast as unknown when fewer than 3 samples are provided", () => {
      const samples: MeterSample[] = [
        {
          resource: "Functions Storage",
          used: 8.0,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-01T00:00:00.000Z",
        },
        {
          resource: "Functions Storage",
          used: 8.5,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-05T00:00:00.000Z",
        },
      ];

      const forecast = calculateGrowthForecast(samples, 10.0);
      expect(forecast.status).toBe("unknown");
      expect(forecast.samplesAnalyzed).toBe(2);
      expect(forecast.reason).toContain("Insufficient temporal samples");
    });

    it("calculates daily consumption rate and estimated days until exhaustion when >= 3 samples exist", () => {
      const samples: MeterSample[] = [
        {
          resource: "Functions Storage",
          used: 8.0,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-01T00:00:00.000Z",
        },
        {
          resource: "Functions Storage",
          used: 8.5,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-06T00:00:00.000Z",
        },
        {
          resource: "Functions Storage",
          used: 9.0,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-11T00:00:00.000Z",
        },
      ];

      const forecast = calculateGrowthForecast(samples, 10.0);
      expect(forecast.status).toBe("available");
      expect(forecast.samplesAnalyzed).toBe(3);
      expect(forecast.consumptionRatePerDay).toBe(0.1); // 1.0 GB over 10 days = 0.1 GB/day
      expect(forecast.estimatedDaysUntilExhaustion).toBe(10); // 1.0 GB remaining / 0.1 GB/day = 10 days
    });

    it("identifies stable or contracting usage trends", () => {
      const samples: MeterSample[] = [
        {
          resource: "Functions Storage",
          used: 9.0,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-01T00:00:00.000Z",
        },
        {
          resource: "Functions Storage",
          used: 8.5,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-05T00:00:00.000Z",
        },
        {
          resource: "Functions Storage",
          used: 8.0,
          limit: 10.0,
          unit: "GB",
          timestamp: "2026-09-10T00:00:00.000Z",
        },
      ];

      const forecast = calculateGrowthForecast(samples, 10.0);
      expect(forecast.status).toBe("available");
      expect(forecast.estimatedDaysUntilExhaustion).toBe(
        "stable_or_contracting"
      );
    });
  });

  describe("4. Alert Manager, Deduplication & Recovery", () => {
    it("dispatches alerts to the notification sink and deduplicates within cooldown window", () => {
      const sink = new MemoryNotificationSink();
      const manager = new HeadroomAlertManager(3600000); // 1 hour cooldown
      const now = new Date("2026-09-12T18:00:00.000Z");

      const evaluated = [
        evaluateMeter(
          {
            resource: "Functions Storage",
            used: 9.6,
            limit: 10.0,
            unit: "GB",
            timestamp: now.toISOString(),
          },
          [],
          DEFAULT_THRESHOLDS,
          now
        ),
      ];

      // First dispatch
      const alerts1 = manager.evaluateAndDispatch(evaluated, sink, now);
      expect(alerts1).toHaveLength(1);
      expect(alerts1[0].severity).toBe("critical");
      expect(sink.recordedAlerts).toHaveLength(1);

      // Repeat dispatch immediately after (within cooldown) -> deduplicated
      const nowSoon = new Date("2026-09-12T18:15:00.000Z"); // 15 minutes later
      const alerts2 = manager.evaluateAndDispatch(evaluated, sink, nowSoon);
      expect(alerts2).toHaveLength(0); // suppressed
      expect(sink.recordedAlerts).toHaveLength(1); // no new alert in sink

      // Dispatch after cooldown expires -> sent
      const nowAfterCooldown = new Date("2026-09-12T19:30:00.000Z"); // 90 minutes later
      const alerts3 = manager.evaluateAndDispatch(
        evaluated,
        sink,
        nowAfterCooldown
      );
      expect(alerts3).toHaveLength(1);
      expect(sink.recordedAlerts).toHaveLength(2);
    });

    it("emits recovery notification when a resource returns to healthy bounds", () => {
      const sink = new MemoryNotificationSink();
      const manager = new HeadroomAlertManager(3600000);
      const time1 = new Date("2026-09-12T18:00:00.000Z");

      // Critical evaluation
      const criticalEvaluated = [
        evaluateMeter(
          {
            resource: "Functions Storage",
            used: 9.6,
            limit: 10.0,
            unit: "GB",
            timestamp: time1.toISOString(),
          },
          [],
          DEFAULT_THRESHOLDS,
          time1
        ),
      ];
      manager.evaluateAndDispatch(criticalEvaluated, sink, time1);
      expect(sink.recordedAlerts).toHaveLength(1);
      expect(sink.recordedAlerts[0].severity).toBe("critical");

      // Later: Post-cleanup recovery evaluation (7.0 GB / 10.0 GB = 70% = healthy)
      const time2 = new Date("2026-09-13T12:00:00.000Z");
      const recoveredEvaluated = [
        evaluateMeter(
          {
            resource: "Functions Storage",
            used: 7.0,
            limit: 10.0,
            unit: "GB",
            timestamp: time2.toISOString(),
          },
          [],
          DEFAULT_THRESHOLDS,
          time2
        ),
      ];
      const recoveryAlerts = manager.evaluateAndDispatch(
        recoveredEvaluated,
        sink,
        time2
      );
      expect(recoveryAlerts).toHaveLength(1);
      expect(recoveryAlerts[0].isRecovery).toBe(true);
      expect(recoveryAlerts[0].message).toContain("RECOVERY");
      expect(sink.recordedAlerts).toHaveLength(2);
    });
  });

  describe("5. Multi-Provider Budget Ledger", () => {
    it("contains all required platform integrations and treats unmeasured meters as unknown", () => {
      const providers = new Set(FREE_TIER_BUDGET_LEDGER.map((e) => e.provider));
      expect(providers).toContain("Vercel");
      expect(providers).toContain("Upstash");
      expect(providers).toContain("Neon");
      expect(providers).toContain("Resend");
      expect(providers).toContain("Clerk");
      expect(providers).toContain("Sentry");

      // Ensure no unmeasured meter is defaulted to 0
      const unmeasured = FREE_TIER_BUDGET_LEDGER.filter(
        (e) => e.observedUsage === null
      );
      expect(unmeasured.length).toBeGreaterThan(0);
      for (const entry of unmeasured) {
        expect(entry.status).toBe("unknown");
        expect(entry.observedUsage).toBeNull();
      }
    });
  });

  describe("6. System Evaluation & Runbook Parity", () => {
    it("evaluates current Vercel Hobby state and flags critical functions storage", () => {
      const result = evaluateVercelHeadroom();
      expect(result.plan).toBe("Vercel Hobby");
      expect(result.hasCriticalAlerts).toBe(true);
      expect(result.meters.functionsStorage.severity).toBe("critical");
      expect(result.meters.deploymentStorage.severity).toBe("healthy");
      expect(result.meters.buildTime.severity).toBe("warning");
    });

    it("executes CLI verification returning success in standard mode and failing in strict mode", async () => {
      const fixedNow = new Date("2026-09-12T18:00:00.000Z");
      const normalResult = await runHeadroomVerification({
        strict: false,
        json: false,
        evalTime: fixedNow,
      });
      expect(normalResult.success).toBe(true);

      const strictResult = await runHeadroomVerification({
        strict: true,
        json: false,
        evalTime: fixedNow,
      });
      expect(strictResult.success).toBe(false); // Fails strict mode due to critical Functions Storage
    });

    it("verifies that docs/how-to/monitor-vercel-headroom.md exists and covers key requirements", () => {
      expect(fs.existsSync(howToPath)).toBe(true);
      const docContent = fs.readFileSync(howToPath, "utf-8");

      expect(docContent).toContain("npm run headroom:vercel");
      expect(docContent).toContain("Functions Storage");
      expect(docContent).toContain("Deployment Storage");
      expect(docContent).toContain("Build Time");
      expect(docContent).toContain("9.68 GB");
      expect(docContent).toContain("6.20 GB");
      expect(docContent).toContain("87.0 hours");
      expect(docContent).toContain("Issue #691");
      expect(docContent).toContain("Issue #698");
      expect(docContent).toContain("Issue #692");
      expect(docContent).toContain("ADR 0036");
      expect(docContent).toContain("HeadroomAlertManager");
    });
  });

  describe("7. Dynamic Clock & Live Vercel API Integration", () => {
    it("defaults evaluateVercelHeadroom evalTime to system clock (new Date())", () => {
      const fixedNow = new Date("2026-09-13T12:00:00.000Z");
      const result = evaluateVercelHeadroom(
        DEFAULT_THRESHOLDS,
        {},
        new HeadroomAlertManager(),
        undefined,
        fixedNow
      );
      expect(result.meters.functionsStorage.isStale).toBe(false);
      expect(result.meters.functionsStorage.severity).toBe("critical");
    });

    it("evaluates snapshot samples older than 30 days as stale when evalTime exceeds 30 days", () => {
      const futureDate = new Date("2026-10-20T00:00:00.000Z"); // > 30 days after snapshot (2026-09-12)
      const result = evaluateVercelHeadroom(
        DEFAULT_THRESHOLDS,
        {},
        new HeadroomAlertManager(),
        undefined,
        futureDate
      );
      expect(result.meters.functionsStorage.isStale).toBe(true);
      expect(result.meters.functionsStorage.severity).toBe("stale");
      expect(result.meters.functionsStorage.message).toContain("stale");
      expect(result.meters.deploymentStorage.isStale).toBe(true);
      expect(result.meters.deploymentStorage.severity).toBe("stale");
      expect(result.meters.buildTime.isStale).toBe(true);
      expect(result.meters.buildTime.severity).toBe("stale");
    });

    it("fetches live Vercel REST API usage when VERCEL_TOKEN is available", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/v6/deployments")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ deployments: [{ id: "dpl_1" }] }),
          });
        }
        if (url.includes("/v2/usage")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                functionsStorage: { used: 4.5 },
                deploymentStorage: { used: 3.2 },
                builds: { used: 42.0 },
              }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const liveResult = await fetchVercelLiveMetrics({
        token: "test_token_123",
        teamId: "team_456",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(liveResult).not.toBeNull();
      expect(liveResult?.meters.functionsStorage?.used).toBe(4.5);
      expect(liveResult?.meters.deploymentStorage?.used).toBe(3.2);
      expect(liveResult?.meters.buildTime?.used).toBe(42.0);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://api.vercel.com/v6/deployments?teamId=team_456"
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test_token_123",
          }),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://api.vercel.com/v2/usage?teamId=team_456"
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test_token_123",
          }),
        })
      );
    });

    it("falls back gracefully to snapshot evaluation when VERCEL_TOKEN is absent", async () => {
      const result = await runHeadroomVerification({
        token: undefined,
        evalTime: new Date("2026-09-13T12:00:00.000Z"),
      });
      expect(result.data.timestamp).toBe("2026-09-12T23:31:22.151Z");
      expect(result.data.meters.functionsStorage.used).toBe(9.68);
    });

    it("evaluates live fetched samples correctly in runHeadroomVerification", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/v2/usage")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                functionsStorage: { used: 2.0 },
                deploymentStorage: { used: 1.0 },
                builds: { used: 10.0 },
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const fixedNow = new Date("2026-09-28T12:00:00.000Z");
      const result = await runHeadroomVerification({
        token: "live_test_token",
        evalTime: fixedNow,
        fetchImpl: mockFetch as unknown as typeof fetch,
        strict: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.hasCriticalAlerts).toBe(false);
      expect(result.data.meters.functionsStorage.severity).toBe("healthy");
      expect(result.data.meters.functionsStorage.used).toBe(2.0);
    });

    it("handles malformed or nonfinite provider values by keeping meters unreadable", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/v2/usage")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                functionsStorage: { used: "invalid_string" },
                deploymentStorage: { used: -50.0 },
                builds: { used: NaN },
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const liveResult = await fetchVercelLiveMetrics({
        token: "live_test_token",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(liveResult).toBeNull(); // No valid meters produced from malformed response

      // Evaluate null live samples to verify unreadable severity
      const evalNull = evaluateMeter({
        resource: "Functions Storage",
        used: null,
        limit: 10.0,
        unit: "GB",
        timestamp: new Date().toISOString(),
      });
      expect(evalNull.severity).toBe("unreadable");
      expect(evalNull.isUnreadable).toBe(true);
    });

    it("normalizes byte counts to GB and seconds to hours explicitly", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/v2/usage")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                functionsStorage: { usedBytes: 5368709120 }, // 5 GB in bytes
                deploymentStorage: { usedBytes: 2147483648 }, // 2 GB in bytes
                builds: { usedSeconds: 7200 }, // 2 hours in seconds
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const liveResult = await fetchVercelLiveMetrics({
        token: "live_test_token",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(liveResult).not.toBeNull();
      expect(liveResult?.meters.functionsStorage?.used).toBe(5.0);
      expect(liveResult?.meters.deploymentStorage?.used).toBe(2.0);
      expect(liveResult?.meters.buildTime?.used).toBe(2.0);
    });

    it("preserves static inventory timestamp on fallback and flags stale data when evalTime > 30 days", () => {
      const futureEvalTime = new Date("2026-11-01T00:00:00.000Z"); // >30 days after snapshot
      const result = evaluateVercelHeadroom(
        DEFAULT_THRESHOLDS,
        {},
        new HeadroomAlertManager(),
        undefined,
        futureEvalTime,
        null // No live samples
      );

      expect(result.timestamp).toBe("2026-09-12T23:31:22.151Z"); // Preserves static fallback timestamp
      expect(result.meters.functionsStorage.severity).toBe("stale");
      expect(result.meters.functionsStorage.isStale).toBe(true);
    });
  });
});
