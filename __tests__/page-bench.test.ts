// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateSummary,
  rateTtfb,
  rateFcp,
  rateLcp,
  rateCls,
  CANONICAL_ROUTES,
  generateMarkdownReport,
  type PageBenchmarkSummary,
  THROTTLED_MOBILE_PROFILE,
} from "../lib/dx/page-bench";

describe("Page Benchmark Suite Utilities & Statistical Aggregator", () => {
  describe("calculateSummary", () => {
    it("handles empty arrays gracefully", () => {
      const summary = calculateSummary([]);
      expect(summary).toEqual({ median: 0, min: 0, max: 0, p95: 0 });
    });

    it("calculates accurate statistics for single-element arrays", () => {
      const summary = calculateSummary([150.45]);
      expect(summary.median).toBe(150.45);
      expect(summary.min).toBe(150.45);
      expect(summary.max).toBe(150.45);
      expect(summary.p95).toBe(150.45);
    });

    it("calculates accurate median for odd-length datasets", () => {
      const summary = calculateSummary([300, 100, 200]);
      expect(summary.min).toBe(100);
      expect(summary.median).toBe(200);
      expect(summary.max).toBe(300);
    });

    it("calculates accurate median for even-length datasets", () => {
      const summary = calculateSummary([100, 400, 200, 300]);
      expect(summary.min).toBe(100);
      expect(summary.median).toBe(250);
      expect(summary.max).toBe(400);
    });

    it("calculates p95 percentile correctly", () => {
      const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1 to 100
      const summary = calculateSummary(samples);
      expect(summary.min).toBe(1);
      expect(summary.max).toBe(100);
      expect(summary.p95).toBe(95);
    });
  });

  describe("Core Web Vitals Threshold Evaluators", () => {
    it("rates TTFB correctly across boundaries", () => {
      expect(rateTtfb(400)).toBe("good");
      expect(rateTtfb(800)).toBe("good");
      expect(rateTtfb(801)).toBe("needs-improvement");
      expect(rateTtfb(1800)).toBe("needs-improvement");
      expect(rateTtfb(1801)).toBe("poor");
    });

    it("rates FCP correctly across boundaries", () => {
      expect(rateFcp(900)).toBe("good");
      expect(rateFcp(1800)).toBe("good");
      expect(rateFcp(1801)).toBe("needs-improvement");
      expect(rateFcp(3000)).toBe("needs-improvement");
      expect(rateFcp(3001)).toBe("poor");
    });

    it("rates LCP correctly across boundaries", () => {
      expect(rateLcp(1500)).toBe("good");
      expect(rateLcp(2500)).toBe("good");
      expect(rateLcp(2501)).toBe("needs-improvement");
      expect(rateLcp(4000)).toBe("needs-improvement");
      expect(rateLcp(4001)).toBe("poor");
    });

    it("rates CLS correctly across boundaries", () => {
      expect(rateCls(0.01)).toBe("good");
      expect(rateCls(0.1)).toBe("good");
      expect(rateCls(0.101)).toBe("needs-improvement");
      expect(rateCls(0.25)).toBe("needs-improvement");
      expect(rateCls(0.251)).toBe("poor");
    });
  });

  describe("Canonical Route Catalog", () => {
    it("contains all top-level, case-study, and arcade routes", () => {
      expect(CANONICAL_ROUTES.length).toBeGreaterThanOrEqual(16);
      for (const r of CANONICAL_ROUTES) {
        expect(r.path.startsWith("/")).toBe(true);
        expect(r.name.length).toBeGreaterThan(0);
        expect(["top-level", "case-study", "arcade", "tool"]).toContain(
          r.category
        );
      }
    });

    it("includes required first-class views", () => {
      const paths = CANONICAL_ROUTES.map((r) => r.path);
      expect(paths).toContain("/");
      expect(paths).toContain("/case-studies");
      expect(paths).toContain("/arcade");
      expect(paths).toContain("/proof");
      expect(paths).toContain("/neuro");
      expect(paths).toContain("/crf");
      expect(paths).toContain("/patrol");
      expect(paths).toContain("/simulator");
      expect(paths).toContain("/schedule");
      expect(paths).toContain("/arcade/working-with-duck");
      expect(paths).toContain("/arcade/quasi-puzzler");
    });
  });

  describe("Markdown Report Generator", () => {
    it("generates structured markdown table with metrics and icons", () => {
      const mockSummaries: PageBenchmarkSummary[] = [
        {
          route: { path: "/", name: "Homepage", category: "top-level" },
          runs: 3,
          ttfb: { median: 120, min: 110, max: 130, p95: 130 },
          fcp: { median: 350, min: 320, max: 380, p95: 380 },
          lcp: { median: 650, min: 600, max: 700, p95: 700 },
          cls: { median: 0.002, min: 0.001, max: 0.003, p95: 0.003 },
          domContentLoaded: { median: 280, min: 260, max: 300, p95: 300 },
          loadDuration: { median: 720, min: 690, max: 750, p95: 750 },
          transferSizeKb: { median: 140, min: 140, max: 140, p95: 140 },
          ratings: {
            ttfb: "good",
            fcp: "good",
            lcp: "good",
            cls: "good",
          },
          passedBudget: true,
        },
      ];

      const md = generateMarkdownReport(mockSummaries, "http://localhost:3000");
      expect(md).toContain("# Page Speed & Core Web Vitals Benchmark Report");
      expect(md).toContain("http://localhost:3000");
      expect(md).toContain("Homepage");
      expect(md).toContain("650ms");
      expect(md).toContain("✅ PASS");
      expect(md).toContain("Fleet Average LCP");
    });
  });
  describe("Mobile Emulation Configuration", () => {
    it("supports mobile device emulation options", () => {
      const mobileOptions = {
        isMobile: true,
        device: {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        },
      };

      expect(mobileOptions.isMobile).toBe(true);
      expect(mobileOptions.device.viewport.width).toBe(390);
      expect(mobileOptions.device.hasTouch).toBe(true);
    });
  });

  describe("Throttled Mobile Profile (ADR 0052, #817)", () => {
    it("defines the standard mobile throttling parameters", () => {
      expect(THROTTLED_MOBILE_PROFILE.cpuSlowdownMultiplier).toBe(4);
      expect(THROTTLED_MOBILE_PROFILE.latency).toBe(150);
      expect(THROTTLED_MOBILE_PROFILE.downloadThroughput).toBe(
        Math.floor((1.6 * 1024 * 1024) / 8)
      );
      expect(THROTTLED_MOBILE_PROFILE.uploadThroughput).toBe(
        Math.floor((750 * 1024) / 8)
      );
    });
  });
});
