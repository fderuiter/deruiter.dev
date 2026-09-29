#!/usr/bin/env node
/** Real-browser Core Web Vitals CLI with reproducible production evidence. */

import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import http from "http";
import path from "path";
import { inspectSourceState } from "../lib/dx/source-state";
import {
  CANONICAL_ROUTES,
  generateMarkdownReport,
  printPageBenchmarkReport,
  runPageBenchmarks,
  type PageBenchmarkRoute,
} from "../lib/dx/page-bench";
import {
  DEFAULT_BENCHMARK_EVIDENCE_DIRECTORY,
  writeBenchmarkEvidence,
  writeBenchmarkMarkdown,
  type BenchmarkEvidence,
  type BenchmarkTarget,
} from "../lib/dx/benchmark-evidence";
import {
  runProductionBenchmark,
  type BenchmarkExecutionDependencies,
  type OwnedBenchmarkServer,
} from "../lib/dx/benchmark-runner";
import { colors, formatHeader } from "../lib/dx/utils";

interface BenchmarkCliOptions {
  baseUrl: string;
  runs: number;
  assertBudget: boolean;
  isMobile: boolean;
  throttled: boolean;
  routeFilter: string | null;
  outputDirectory: string;
}

function appendDiagnostics(current: string, chunk: Buffer | string): string {
  const combined = `${current}${chunk.toString()}`;
  return combined.length > 12_000 ? combined.slice(-12_000) : combined;
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, timeoutMs);
    child.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function createOwnedServer(
  child: ChildProcess,
  diagnostics: () => string
): OwnedBenchmarkServer {
  return {
    diagnostics,
    isReady: () => /Ready in/.test(diagnostics()),
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await waitForExit(child, 3_000);
    },
  };
}

async function runProcess(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv = process.env
): Promise<{ code: number; diagnostics: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let diagnostics = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      diagnostics = appendDiagnostics(diagnostics, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      diagnostics = appendDiagnostics(diagnostics, chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, diagnostics }));
  });
}

function productionEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk",
    CLERK_SECRET_KEY:
      process.env.CLERK_SECRET_KEY || "sk_test_example_secret_key",
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgres" + "ql://localhost:5432/portfolio_dev",
  };
}

function inspectSource() {
  return inspectSourceState(process.cwd());
}

async function probeTarget(
  target: BenchmarkTarget
): Promise<{ ready: boolean; diagnostics: string }> {
  return new Promise((resolve) => {
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: "/",
        method: "GET",
        timeout: 2_000,
      },
      (response) => {
        response.resume();
        resolve({
          ready: response.statusCode !== undefined && response.statusCode < 500,
          diagnostics: `HTTP ${response.statusCode ?? "unknown"} from ${target.url}`,
        });
      }
    );
    request.once("error", (error: Error) =>
      resolve({ ready: false, diagnostics: error.message })
    );
    request.once("timeout", () => {
      request.destroy();
      resolve({
        ready: false,
        diagnostics: `Timed out connecting to ${target.url}`,
      });
    });
    request.end();
  });
}

async function waitForProductionServer(
  target: BenchmarkTarget,
  server: OwnedBenchmarkServer
): Promise<{ ready: boolean; diagnostics: string }> {
  const startedAt = Date.now();
  let lastProbe = "No response yet.";
  while (Date.now() - startedAt < 30_000) {
    if (!server.isReady()) {
      lastProbe = "Waiting for the owned production server readiness signal.";
      if (/EADDRINUSE|Error:|Failed to start/.test(server.diagnostics())) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    const probe = await probeTarget(target);
    if (probe.ready) return { ready: true, diagnostics: probe.diagnostics };
    lastProbe = probe.diagnostics;
    if (server.diagnostics().includes("EADDRINUSE")) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return {
    ready: false,
    diagnostics: `${lastProbe}\nServer output:\n${server.diagnostics()}`.trim(),
  };
}

function parseOptions(args: string[]): BenchmarkCliOptions | null {
  const options: BenchmarkCliOptions = {
    baseUrl: "http://localhost:3000",
    runs: 3,
    assertBudget: false,
    isMobile: false,
    throttled: false,
    routeFilter: null,
    outputDirectory: path.resolve(DEFAULT_BENCHMARK_EVIDENCE_DIRECTORY),
  };

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const next = args[index + 1];
    if (argument === "--url") {
      if (!next) throw new Error("--url requires a target URL.");
      options.baseUrl = next;
      index++;
    } else if (argument === "--runs") {
      if (!next || !/^\d+$/.test(next) || Number(next) < 1) {
        throw new Error("--runs must be a positive integer.");
      }
      options.runs = Number(next);
      index++;
    } else if (argument === "--assert" || argument === "--budget") {
      options.assertBudget = true;
    } else if (argument === "--mobile" || argument === "-m") {
      options.isMobile = true;
    } else if (argument === "--throttled") {
      options.throttled = true;
    } else if (argument === "--routes") {
      if (!next) throw new Error("--routes requires a pattern.");
      try {
        new RegExp(next, "i");
      } catch {
        throw new Error(`--routes must be a valid regular expression: ${next}`);
      }
      options.routeFilter = next;
      index++;
    } else if (argument === "--output") {
      if (!next) throw new Error("--output requires a directory.");
      options.outputDirectory = path.resolve(next);
      index++;
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        formatHeader(
          "Page Performance Benchmarking CLI",
          "Reproducible Production Evidence"
        )
      );
      console.log(
        `${colors.bold}Usage:${colors.reset} npx tsx scripts/benchmark-pages.ts [options]\n`
      );
      console.log(`${colors.bold}Options:${colors.reset}`);
      console.log(
        `  --url <url>        Target URL; assertions use an owned local HTTP server`
      );
      console.log(`  --runs <n>         Measured runs per page (default: 3)`);
      console.log(`  --mobile, -m       Emulate a 390x844 touch viewport`);
      console.log(
        `  --throttled        Emulate throttled mobile profile (4x CPU slowdown, 1.6 Mbps / 750 kbps, 150ms RTT)`
      );
      console.log(
        `  --routes <pattern> Filter canonical routes by path or name`
      );
      console.log(
        `  --assert, --budget Require fresh, clean, owned production evidence`
      );
      console.log(
        `  --output <dir>     Evidence directory (default: .benchmark-results)`
      );
      console.log(`  --help, -h         Show this help menu\n`);
      return null;
    } else {
      throw new Error(`Unknown benchmark option: ${argument}`);
    }
  }
  return options;
}

function selectRoutes(routeFilter: string | null): PageBenchmarkRoute[] {
  if (!routeFilter) return CANONICAL_ROUTES;
  const expression = new RegExp(routeFilter, "i");
  const selected = CANONICAL_ROUTES.filter(
    (route) => expression.test(route.path) || expression.test(route.name)
  );
  if (selected.length === 0)
    throw new Error(`No routes matched filter '${routeFilter}'.`);
  return selected;
}

function createProductionDependencies(
  routes: PageBenchmarkRoute[]
): BenchmarkExecutionDependencies {
  let server: OwnedBenchmarkServer | null = null;
  return {
    inspectSource,
    async buildProduction() {
      const result = await runProcess(
        "npm",
        ["run", "build"],
        productionEnvironment()
      );
      if (result.code !== 0) {
        throw new Error(
          `Production build failed (exit ${result.code}):\n${result.diagnostics}`
        );
      }
      const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
      const buildId = fs.existsSync(buildIdPath)
        ? fs.readFileSync(buildIdPath, "utf-8").trim()
        : "";
      if (!buildId)
        throw new Error(
          "Production build completed without a Next.js BUILD_ID."
        );
      return {
        buildId,
        diagnostics: result.diagnostics,
        completedAt: new Date().toISOString(),
      };
    },
    async startProductionServer(target) {
      let diagnostics = "";
      const nextBin = path.join(
        process.cwd(),
        "node_modules",
        "next",
        "dist",
        "bin",
        "next"
      );
      const child = spawn(
        process.execPath,
        [nextBin, "start", "-p", String(target.port)],
        {
          cwd: process.cwd(),
          env: productionEnvironment(),
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      child.stdout?.on("data", (chunk: Buffer) => {
        diagnostics = appendDiagnostics(diagnostics, chunk);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        diagnostics = appendDiagnostics(diagnostics, chunk);
      });
      server = createOwnedServer(child, () => diagnostics);
      return server;
    },
    async waitForServer(target) {
      if (!server)
        return {
          ready: false,
          diagnostics: "Benchmark server was not created.",
        };
      return waitForProductionServer(target, server);
    },
    async runPageBenchmarks(input) {
      return runPageBenchmarks({ ...input, routes });
    },
  };
}

async function runExploratoryBenchmark(
  options: BenchmarkCliOptions,
  routes: PageBenchmarkRoute[]
): Promise<BenchmarkEvidence> {
  const target = new URL(options.baseUrl);
  const port = Number(
    target.port || (target.protocol === "https:" ? "443" : "80")
  );
  const summaries = await runPageBenchmarks({
    baseUrl: target.toString(),
    runs: options.runs,
    routes,
    isMobile: options.isMobile,
    throttled: options.throttled,
  });
  const source = inspectSource();
  return {
    version: 1,
    mode: "exploratory",
    capturedAt: new Date().toISOString(),
    source,
    build: {
      mode: "unknown",
      fresh: false,
      sourceRevision: null,
      sourceDirty: null,
      buildId: null,
      command: null,
      completedAt: null,
    },
    target: {
      url: target.toString(),
      hostname: target.hostname,
      port,
      ownership: "external",
      serverMode: "unknown",
      startupDiagnostics: "External target; provenance not asserted.",
    },
    browser: {
      engine: "chromium",
      headless: true,
      viewport: options.isMobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
      isMobile: options.isMobile,
      hasTouch: options.isMobile,
      throttled: options.throttled,
    },
    sampling: { warmupRuns: 1, measuredRuns: options.runs },
    assertion: {
      budgetEnabled: false,
      expectedRoutes: routes.map((route) => route.path),
    },
    routes: summaries,
  };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args);
  if (!options) return;
  const routes = selectRoutes(options.routeFilter);
  const evidence = options.assertBudget
    ? await runProductionBenchmark(
        {
          url: options.baseUrl,
          runs: options.runs,
          routes: routes.map((route) => route.path),
          isMobile: options.isMobile,
          throttled: options.throttled,
        },
        createProductionDependencies(routes)
      )
    : await runExploratoryBenchmark(options, routes);
  printPageBenchmarkReport(evidence.routes, evidence.target.url);
  const evidencePath = writeBenchmarkEvidence(
    evidence,
    options.outputDirectory
  );
  const markdownPath = writeBenchmarkMarkdown(
    generateMarkdownReport(evidence.routes, evidence.target.url),
    options.outputDirectory
  );
  console.log(
    `${colors.dim}Exported ${evidence.mode} evidence:${colors.reset}`
  );
  console.log(
    `  • Markdown: ${colors.cyan}${path.relative(process.cwd(), markdownPath)}${colors.reset}`
  );
  console.log(
    `  • JSON:     ${colors.cyan}${path.relative(process.cwd(), evidencePath)}${colors.reset}`
  );
}

if (typeof process.env.VITEST === "undefined" && require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${colors.brightRed}Benchmark execution error:${colors.reset} ${message}`
    );
    process.exitCode = 1;
  });
}
