/**
 * Page Performance & Core Web Vitals Benchmarking Engine
 * Measures real-browser rendering latency, navigation timing, and Web Vitals across portfolio routes.
 */

import type { Browser, Page } from "@playwright/test";
import { launchChromiumWithFallback } from "./browser-launch";
import { colors, formatHeader, formatSection, renderTable } from "./utils";
import {
  PUBLIC_ROUTE_REGISTRY,
  type PublicRouteDefinition,
} from "@/lib/public-routes";
import fs from "fs";
import path from "path";

export type PageBenchmarkRoute = PublicRouteDefinition;

export const CANONICAL_ROUTES: PageBenchmarkRoute[] = PUBLIC_ROUTE_REGISTRY.map(
  (route) => ({ ...route })
);

export interface SingleRunMetrics {
  ttfb: number; // Time to First Byte (ms)
  fcp: number; // First Contentful Paint (ms)
  lcp: number; // Largest Contentful Paint (ms)
  cls: number; // Cumulative Layout Shift
  domContentLoaded: number; // DOMContentLoaded (ms)
  loadDuration: number; // Full Load (ms)
  transferSizeKb: number; // Total transfer size (KB)
}

export interface MetricSummary {
  median: number;
  min: number;
  max: number;
  p95: number;
}

export type WebVitalRating = "good" | "needs-improvement" | "poor";

export interface PageBenchmarkSummary {
  route: PageBenchmarkRoute;
  runs: number;
  ttfb: MetricSummary;
  fcp: MetricSummary;
  lcp: MetricSummary;
  cls: MetricSummary;
  domContentLoaded: MetricSummary;
  loadDuration: MetricSummary;
  transferSizeKb: MetricSummary;
  ratings: {
    ttfb: WebVitalRating;
    fcp: WebVitalRating;
    lcp: WebVitalRating;
    cls: WebVitalRating;
  };
  passedBudget: boolean;
}

export interface BenchmarkThresholds {
  maxTtfbMs: number; // Good: <= 800ms
  maxFcpMs: number; // Good: <= 1800ms
  maxLcpMs: number; // Good: <= 2500ms
  maxCls: number; // Good: <= 0.1
}

export const DEFAULT_THRESHOLDS: BenchmarkThresholds = {
  maxTtfbMs: 800,
  maxFcpMs: 2000,
  maxLcpMs: 2500,
  maxCls: 0.1,
};

export function calculateSummary(values: number[]): MetricSummary {
  if (values.length === 0) {
    return { median: 0, min: 0, max: 0, p95: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const min = Number(sorted[0].toFixed(2));
  const max = Number(sorted[sorted.length - 1].toFixed(2));

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median = Number(
    (sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    ).toFixed(2)
  );

  // P95 (Nearest-rank method)
  const p95Index = Math.min(
    sorted.length - 1,
    Math.ceil(0.95 * sorted.length) - 1
  );
  const p95 = Number(sorted[p95Index].toFixed(2));

  return { median, min, max, p95 };
}

export function rateTtfb(ms: number): WebVitalRating {
  if (ms <= 800) return "good";
  if (ms <= 1800) return "needs-improvement";
  return "poor";
}

export function rateFcp(ms: number): WebVitalRating {
  if (ms <= 1800) return "good";
  if (ms <= 3000) return "needs-improvement";
  return "poor";
}

export function rateLcp(ms: number): WebVitalRating {
  if (ms <= 2500) return "good";
  if (ms <= 4000) return "needs-improvement";
  return "poor";
}

export function rateCls(cls: number): WebVitalRating {
  if (cls <= 0.1) return "good";
  if (cls <= 0.25) return "needs-improvement";
  return "poor";
}

export function formatRatingColor(
  val: string | number,
  rating: WebVitalRating
): string {
  switch (rating) {
    case "good":
      return `${colors.brightGreen}${val}${colors.reset}`;
    case "needs-improvement":
      return `${colors.brightYellow}${val}${colors.reset}`;
    case "poor":
      return `${colors.brightRed}${val}${colors.reset}`;
  }
}

/**
 * Capture raw performance metrics for a single navigation via Playwright
 */
export async function measurePageRoute(
  page: Page,
  url: string
): Promise<SingleRunMetrics> {
  // Navigate and wait for page to reach load state
  await page.goto(url, { waitUntil: "load", timeout: 30000 });

  // Give a brief window for layout shifts & LCP observers to settle
  await page.waitForTimeout(200);

  const metrics = await page.evaluate((): SingleRunMetrics => {
    // 1. Navigation Timing Level 2
    const navEntries = performance.getEntriesByType(
      "navigation"
    ) as PerformanceNavigationTiming[];
    const nav = navEntries && navEntries.length > 0 ? navEntries[0] : null;

    let ttfb = 0;
    let domContentLoaded = 0;
    let loadDuration = 0;
    let transferSizeKb = 0;

    if (nav) {
      ttfb = Math.max(0, nav.responseStart - nav.requestStart);
      if (ttfb === 0 && nav.responseStart > 0) {
        ttfb = Math.max(0, nav.responseStart - nav.startTime);
      }
      domContentLoaded = Math.max(
        0,
        nav.domContentLoadedEventEnd - nav.startTime
      );
      loadDuration = Math.max(0, nav.loadEventEnd - nav.startTime);
      transferSizeKb = (nav.encodedBodySize || nav.transferSize || 0) / 1024;
    }

    // 2. Paint Timing (FCP)
    let fcp = 0;
    const paintEntries = performance.getEntriesByType("paint");
    for (const entry of paintEntries) {
      if (entry.name === "first-contentful-paint") {
        fcp = entry.startTime;
      }
    }

    // 3. Fallbacks for Paint if paint timing wasn't triggered
    if (fcp === 0 && nav) {
      fcp = domContentLoaded;
    }

    // 4. LCP and CLS from performance timeline if available
    let lcp = fcp;
    const lcpEntries = performance.getEntriesByType(
      "largest-contentful-paint"
    ) as PerformanceEntry[];
    if (lcpEntries && lcpEntries.length > 0) {
      lcp = lcpEntries[lcpEntries.length - 1].startTime;
    }

    // Layout shift entries
    let cls = 0;
    const layoutShiftEntries = performance.getEntriesByType(
      "layout-shift"
    ) as (PerformanceEntry & {
      hadRecentInput?: boolean;
      value?: number;
    })[];
    if (layoutShiftEntries && layoutShiftEntries.length > 0) {
      for (const entry of layoutShiftEntries) {
        if (!entry.hadRecentInput && typeof entry.value === "number") {
          cls += entry.value;
        }
      }
    }

    return {
      ttfb: Number(ttfb.toFixed(1)),
      fcp: Number(fcp.toFixed(1)),
      lcp: Number(lcp.toFixed(1)),
      cls: Number(cls.toFixed(4)),
      domContentLoaded: Number(domContentLoaded.toFixed(1)),
      loadDuration: Number(loadDuration.toFixed(1)),
      transferSizeKb: Number(transferSizeKb.toFixed(1)),
    };
  });

  return metrics;
}

export const THROTTLED_MOBILE_PROFILE = {
  cpuSlowdownMultiplier: 4,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8), // 1.6 Mbps
  uploadThroughput: Math.floor((750 * 1024) / 8), // 750 kbps
  latency: 150, // 150 ms RTT
} as const;

export interface RunOptions {
  baseUrl?: string;
  runs?: number;
  routes?: PageBenchmarkRoute[];
  thresholds?: BenchmarkThresholds;
  isMobile?: boolean;
  throttled?: boolean;
  device?: {
    viewport: { width: number; height: number };
    isMobile?: boolean;
    hasTouch?: boolean;
    userAgent?: string;
  };
  onProgress?: (progress: {
    route: PageBenchmarkRoute;
    currentRun: number;
    totalRuns: number;
    metrics?: SingleRunMetrics;
  }) => void;
}

/**
 * Execute Page Benchmark Suite across specified routes
 */
export async function runPageBenchmarks(
  options: RunOptions = {}
): Promise<PageBenchmarkSummary[]> {
  const baseUrl = options.baseUrl || "http://localhost:3000";
  const runs = options.runs || 3;
  const routes = options.routes || CANONICAL_ROUTES;
  const thresholds = options.thresholds || DEFAULT_THRESHOLDS;
  const isMobile = options.isMobile || false;
  const throttled = options.throttled || false;

  let browser: Browser | null = null;
  const summaries: PageBenchmarkSummary[] = [];

  try {
    browser = await launchChromiumWithFallback({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const contextOptions =
      options.device ||
      (isMobile
        ? {
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
            userAgent:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          }
        : {
            viewport: { width: 1280, height: 800 },
            isMobile: false,
            hasTouch: false,
          });

    let currentContext = await browser.newContext(contextOptions);
    let routeIndex = 0;

    for (const route of routes) {
      if (routeIndex > 0 && routeIndex % 5 === 0) {
        await currentContext.close().catch(() => {});
        currentContext = await browser.newContext(contextOptions);
      }
      routeIndex++;

      const pageUrl = `${baseUrl.replace(/\/$/, "")}${route.path}`;

      const createAndConfigurePage = async (): Promise<Page> => {
        const page = await currentContext.newPage();
        if (throttled) {
          try {
            const client = await currentContext.newCDPSession(page);
            await client.send("Emulation.setCPUThrottlingRate", {
              rate: THROTTLED_MOBILE_PROFILE.cpuSlowdownMultiplier,
            });
            await client.send("Network.enable");
            await client.send("Network.emulateNetworkConditions", {
              offline: false,
              latency: THROTTLED_MOBILE_PROFILE.latency,
              downloadThroughput: THROTTLED_MOBILE_PROFILE.downloadThroughput,
              uploadThroughput: THROTTLED_MOBILE_PROFILE.uploadThroughput,
            });
          } catch (error) {
            await page.close();
            throw new Error(
              `Throttled benchmark requested but CDP throttling failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
        return page;
      };

      // Warmup run
      if (options.onProgress) {
        options.onProgress({ route, currentRun: 0, totalRuns: runs });
      }
      try {
        const warmupPage = await createAndConfigurePage();
        try {
          await measurePageRoute(warmupPage, pageUrl);
        } finally {
          await warmupPage.close();
        }
      } catch {
        // Ignore warmup error
      }

      // Measured runs
      const samples: SingleRunMetrics[] = [];
      for (let run = 1; run <= runs; run++) {
        const runPage = await createAndConfigurePage();
        try {
          const metrics = await measurePageRoute(runPage, pageUrl);
          samples.push(metrics);
          if (options.onProgress) {
            options.onProgress({
              route,
              currentRun: run,
              totalRuns: runs,
              metrics,
            });
          }
        } finally {
          await runPage.close();
        }
      }

      const ttfbSummary = calculateSummary(samples.map((s) => s.ttfb));
      const fcpSummary = calculateSummary(samples.map((s) => s.fcp));
      const lcpSummary = calculateSummary(samples.map((s) => s.lcp));
      const clsSummary = calculateSummary(samples.map((s) => s.cls));
      const domSummary = calculateSummary(
        samples.map((s) => s.domContentLoaded)
      );
      const loadSummary = calculateSummary(samples.map((s) => s.loadDuration));
      const sizeSummary = calculateSummary(
        samples.map((s) => s.transferSizeKb)
      );

      const ratings = {
        ttfb: rateTtfb(ttfbSummary.median),
        fcp: rateFcp(fcpSummary.median),
        lcp: rateLcp(lcpSummary.median),
        cls: rateCls(clsSummary.median),
      };

      const passedBudget =
        ttfbSummary.median <= thresholds.maxTtfbMs &&
        fcpSummary.median <= thresholds.maxFcpMs &&
        lcpSummary.median <= thresholds.maxLcpMs &&
        clsSummary.median <= thresholds.maxCls;

      summaries.push({
        route,
        runs,
        ttfb: ttfbSummary,
        fcp: fcpSummary,
        lcp: lcpSummary,
        cls: clsSummary,
        domContentLoaded: domSummary,
        loadDuration: loadSummary,
        transferSizeKb: sizeSummary,
        ratings,
        passedBudget,
      });
    }

    await currentContext.close();
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return summaries;
}

/**
 * Render Formatted Terminal Table with Core Web Vitals Ratings
 */
export function printPageBenchmarkReport(
  summaries: PageBenchmarkSummary[],
  baseUrl = "http://localhost:3000"
): void {
  console.log(
    formatHeader(
      "Real-Browser Page Speed & Core Web Vitals Report",
      `Target: ${baseUrl} • Samples: 1 warmup + ${summaries[0]?.runs || 3} measured`
    )
  );

  console.log(
    `${colors.dim}Legend: ${colors.brightGreen}■ Good${colors.reset} ${colors.dim}|${colors.reset} ${colors.brightYellow}■ Needs Improvement${colors.reset} ${colors.dim}|${colors.reset} ${colors.brightRed}■ Poor${colors.reset}\n`
  );

  const rows = summaries.map((s) => {
    const ttfbStr = formatRatingColor(`${s.ttfb.median}ms`, s.ratings.ttfb);
    const fcpStr = formatRatingColor(`${s.fcp.median}ms`, s.ratings.fcp);
    const lcpStr = formatRatingColor(`${s.lcp.median}ms`, s.ratings.lcp);
    const clsStr = formatRatingColor(s.cls.median.toFixed(3), s.ratings.cls);
    const domStr = `${s.domContentLoaded.median}ms`;
    const loadStr = `${s.loadDuration.median}ms`;
    const budgetStr = s.passedBudget
      ? `${colors.brightGreen}PASS${colors.reset}`
      : `${colors.brightRed}FAIL${colors.reset}`;

    return {
      route: s.route.path,
      name: s.route.name,
      ttfb: ttfbStr,
      fcp: fcpStr,
      lcp: lcpStr,
      cls: clsStr,
      dcl: domStr,
      load: loadStr,
      budget: budgetStr,
    };
  });

  console.log(
    renderTable(
      [
        { header: "Route", key: "route", width: 28 },
        { header: "Page Name", key: "name", width: 26 },
        { header: "TTFB (med)", key: "ttfb", width: 12, align: "right" },
        { header: "FCP (med)", key: "fcp", width: 12, align: "right" },
        { header: "LCP (med)", key: "lcp", width: 12, align: "right" },
        { header: "CLS", key: "cls", width: 10, align: "right" },
        { header: "DCL (med)", key: "dcl", width: 12, align: "right" },
        { header: "Load (med)", key: "load", width: 12, align: "right" },
        { header: "Budget", key: "budget", width: 8, align: "right" },
      ],
      rows
    )
  );

  // Group Summary Stats
  const avgLcp =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((sum, s) => sum + s.lcp.median, 0) / summaries.length
        )
      : 0;
  const avgTtfb =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((sum, s) => sum + s.ttfb.median, 0) /
            summaries.length
        )
      : 0;
  const avgLoad =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((sum, s) => sum + s.loadDuration.median, 0) /
            summaries.length
        )
      : 0;
  const totalPassed = summaries.filter((s) => s.passedBudget).length;

  console.log(formatSection("Executive Summary & SLAs"));
  console.log(
    `  • ${colors.bold}Total Pages Tested:${colors.reset} ${summaries.length}`
  );
  console.log(
    `  • ${colors.bold}Passing Web Vitals Budget:${colors.reset} ${totalPassed} / ${summaries.length}`
  );
  console.log(
    `  • ${colors.bold}Fleet Average TTFB:${colors.reset} ${avgTtfb}ms`
  );
  console.log(
    `  • ${colors.bold}Fleet Average LCP:${colors.reset} ${avgLcp}ms`
  );
  console.log(
    `  • ${colors.bold}Fleet Average Full Load:${colors.reset} ${avgLoad}ms\n`
  );
}

/**
 * Generate Markdown Report of Benchmark Results
 */
export function generateMarkdownReport(
  summaries: PageBenchmarkSummary[],
  baseUrl = "http://localhost:3000"
): string {
  let md = `# Page Speed & Core Web Vitals Benchmark Report\n\n`;
  md += `**Target URL**: \`${baseUrl}\`  \n`;
  md += `**Generated**: ${new Date().toISOString()}  \n`;
  md += `**Sampling**: 1 warmup + ${summaries[0]?.runs || 3} measured runs per route (Median / P95 values reported)\n\n`;

  md += `## Route Performance Matrix\n\n`;
  md += `| Route | Page / Feature | TTFB (Median) | FCP (Median) | LCP (Median) | CLS | DOMContentLoaded | Full Load | Budget |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const s of summaries) {
    const ttfbIcon =
      s.ratings.ttfb === "good"
        ? "🟢"
        : s.ratings.ttfb === "needs-improvement"
          ? "🟡"
          : "🔴";
    const fcpIcon =
      s.ratings.fcp === "good"
        ? "🟢"
        : s.ratings.fcp === "needs-improvement"
          ? "🟡"
          : "🔴";
    const lcpIcon =
      s.ratings.lcp === "good"
        ? "🟢"
        : s.ratings.lcp === "needs-improvement"
          ? "🟡"
          : "🔴";
    const clsIcon =
      s.ratings.cls === "good"
        ? "🟢"
        : s.ratings.cls === "needs-improvement"
          ? "🟡"
          : "🔴";
    const budgetStatus = s.passedBudget ? "✅ PASS" : "❌ FAIL";

    md += `| \`${s.route.path}\` | ${s.route.name} | ${ttfbIcon} ${s.ttfb.median}ms | ${fcpIcon} ${s.fcp.median}ms | ${lcpIcon} ${s.lcp.median}ms | ${clsIcon} ${s.cls.median.toFixed(3)} | ${s.domContentLoaded.median}ms | ${s.loadDuration.median}ms | ${budgetStatus} |\n`;
  }

  const avgLcp =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((sum, s) => sum + s.lcp.median, 0) / summaries.length
        )
      : 0;
  const avgTtfb =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((sum, s) => sum + s.ttfb.median, 0) /
            summaries.length
        )
      : 0;
  const avgLoad =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((sum, s) => sum + s.loadDuration.median, 0) /
            summaries.length
        )
      : 0;
  const passCount = summaries.filter((s) => s.passedBudget).length;

  md += `\n## Aggregate Metrics\n\n`;
  md += `- **Total Routes Tested**: ${summaries.length}\n`;
  md += `- **Routes Passing Budget**: ${passCount} / ${summaries.length} (${summaries.length > 0 ? ((passCount / summaries.length) * 100).toFixed(0) : 0}%)\n`;
  md += `- **Fleet Average TTFB**: ${avgTtfb}ms\n`;
  md += `- **Fleet Average LCP**: ${avgLcp}ms\n`;
  md += `- **Fleet Average Load Duration**: ${avgLoad}ms\n\n`;

  md += `## Core Web Vitals Thresholds (Google Web Vitals)\n\n`;
  md += `| Metric | Good (🟢) | Needs Improvement (🟡) | Poor (🔴) |\n`;
  md += `| :--- | :---: | :---: | :---: |\n`;
  md += `| **TTFB** | ≤ 800ms | 800ms - 1800ms | > 1800ms |\n`;
  md += `| **FCP** | ≤ 1800ms | 1800ms - 3000ms | > 3000ms |\n`;
  md += `| **LCP** | ≤ 2500ms | 2500ms - 4000ms | > 4000ms |\n`;
  md += `| **CLS** | ≤ 0.100 | 0.100 - 0.250 | > 0.250 |\n`;

  return md;
}

/**
 * Save benchmark results to disk in Markdown and JSON formats
 */
export function exportBenchmarkResults(
  summaries: PageBenchmarkSummary[],
  outDir = process.cwd(),
  baseUrl = "http://localhost:3000"
): {
  jsonPath: string;
  markdownPath: string;
} {
  const jsonPath = path.join(outDir, "benchmark-results.json");
  const markdownPath = path.join(outDir, "benchmark-results.md");

  const jsonPayload = {
    targetUrl: baseUrl,
    timestamp: new Date().toISOString(),
    thresholds: DEFAULT_THRESHOLDS,
    routes: summaries,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), "utf-8");
  fs.writeFileSync(
    markdownPath,
    generateMarkdownReport(summaries, baseUrl),
    "utf-8"
  );

  return { jsonPath, markdownPath };
}
