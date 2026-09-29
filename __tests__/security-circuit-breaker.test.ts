/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { generateSecurityManifest } from "../scripts/security-audit";
import {
  evaluateCircuitBreaker,
  resetManifestCache,
} from "../lib/security-circuit-breaker";
import { createApiHandler } from "../lib/route-wrapper";
import { logger } from "../lib/logger";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Runtime Security Circuit Breaker Suite", () => {
  const manifestPath = path.join(
    process.cwd(),
    "lib",
    "security-manifest.json"
  );
  let originalManifestContent: string | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    resetManifestCache();

    if (fs.existsSync(manifestPath)) {
      originalManifestContent = fs.readFileSync(manifestPath, "utf8");
    } else {
      originalManifestContent = null;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetManifestCache();
    if (originalManifestContent !== null) {
      fs.writeFileSync(manifestPath, originalManifestContent, "utf8");
    } else if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
    }
  });

  describe("Build Audit Manifest Generation", () => {
    it("exports a structured security manifest containing active CVE rules and expiration dates", () => {
      const futureDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const mockIgnoreList = [
        {
          advisory: "CVE-2026-1234",
          package: "test-vulnerable-package",
          expiresAt: futureDate,
          reason: "Upstream fix pending",
          owner: "security-team",
          followUp: "#1001",
        },
      ];

      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(mockIgnoreList)
      );

      const manifest = generateSecurityManifest(new Date());

      expect(manifest).toBeDefined();
      expect(manifest.generatedAt).toBeDefined();
      expect(manifest.activeRules).toHaveLength(1);
      expect(manifest.activeRules[0].advisory).toBe("CVE-2026-1234");
      expect(manifest.activeRules[0].package).toBe("test-vulnerable-package");
      expect(manifest.activeRules[0].expiresAt).toBe(futureDate);
    });

    it("filters out expired vulnerability rules from the active security manifest", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const mockIgnoreList = [
        {
          advisory: "CVE-2025-9999",
          package: "expired-package",
          expiresAt: pastDate,
          reason: "Expired exception",
          owner: "security-team",
          followUp: "#999",
        },
      ];

      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(mockIgnoreList)
      );

      const manifest = generateSecurityManifest(new Date());
      expect(manifest.activeRules).toHaveLength(0);
    });
  });

  describe("Route Wrapper Circuit Breaker Evaluation", () => {
    it("evaluates circuit breaker state in under 5 milliseconds", () => {
      const activeRules = [
        {
          advisory: "CVE-2026-5555",
          package: "fast-check-pkg",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          reason: "Testing latency",
          owner: "perf-team",
          followUp: "#555",
        },
      ];

      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ generatedAt: new Date().toISOString(), activeRules }),
        "utf8"
      );
      resetManifestCache();

      const startTime = performance.now();
      const result = evaluateCircuitBreaker(["fast-check-pkg"]);
      const duration = performance.now() - startTime;

      expect(result.tripped).toBe(true);
      expect(duration).toBeLessThan(5);
    });

    it("returns HTTP 503 status with Retry-After and X-Circuit-Breaker-Tripped headers when tripped", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const activeRules = [
        {
          advisory: "GHSA-tripped-cve",
          package: "vulnerable-data-lib",
          expiresAt: futureDate,
          reason: "Data path isolation test",
          owner: "sec-ops",
          followUp: "#777",
        },
      ];

      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ generatedAt: new Date().toISOString(), activeRules }),
        "utf8"
      );
      resetManifestCache();

      const sampleHandler = createApiHandler(
        async () => {
          return NextResponse.json({ ok: true });
        },
        {
          packages: ["vulnerable-data-lib"],
          retryAfterSeconds: 600,
        }
      );

      const req = new NextRequest("http://localhost:3000/api/test-endpoint");
      const res = await sampleHandler(req);

      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("600");
      expect(res.headers.get("X-Circuit-Breaker-Tripped")).toBe("true");

      const body = await res.json();
      expect(body.error).toContain("Service Unavailable");
      expect(body.package).toBe("vulnerable-data-lib");
      expect(body.advisory).toBe("GHSA-tripped-cve");

      expect(logger.warn).toHaveBeenCalledWith(
        "Data path security circuit breaker tripped:",
        expect.objectContaining({
          package: "vulnerable-data-lib",
          advisory: "GHSA-tripped-cve",
          owner: "sec-ops",
          followUp: "#777",
        })
      );
    });

    it("permits request execution when declared package dependencies are not affected by active rules", async () => {
      const activeRules = [
        {
          advisory: "GHSA-unrelated",
          package: "unrelated-package",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          reason: "Unrelated issue",
          owner: "sec-ops",
          followUp: "#888",
        },
      ];

      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ generatedAt: new Date().toISOString(), activeRules }),
        "utf8"
      );
      resetManifestCache();

      const sampleHandler = createApiHandler(
        async () => {
          return NextResponse.json({ success: true }, { status: 200 });
        },
        {
          packages: ["safe-package"],
        }
      );

      const req = new NextRequest("http://localhost:3000/api/safe-endpoint");
      const res = await sampleHandler(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(res.headers.get("X-Circuit-Breaker-Tripped")).toBeNull();
    });

    it("leaves public routes without declared package dependencies operational when clinical circuit breakers trip", async () => {
      const activeRules = [
        {
          advisory: "CVE-2026-CLINICAL",
          package: "clinical-engine",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          reason: "Clinical path vulnerability",
          owner: "clinical-team",
          followUp: "#999",
        },
      ];

      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ generatedAt: new Date().toISOString(), activeRules }),
        "utf8"
      );
      resetManifestCache();

      const publicReadRoute = createApiHandler(async () => {
        return NextResponse.json({ status: "healthy" });
      });

      const req = new NextRequest("http://localhost:3000/api/public-health");
      const res = await publicReadRoute(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("healthy");
    });
  });
});
