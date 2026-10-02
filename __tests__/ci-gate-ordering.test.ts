// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

/**
 * `npm run verify` includes invariants that assert against artifacts other
 * phases produce: the bundle budget needs a production build, and the
 * Core Web Vitals SLA reads `.benchmark-results/benchmark-results.v1.json`,
 * which only `bench:pages` writes and which is validated against the current
 * revision. Running verify before those phases makes the SLA gate unpassable.
 *
 * The `quality` script already encodes the correct order; CI must agree.
 * Since #1767 those phases run in separate jobs, so "before" means both an
 * earlier line in the file and a `needs:` edge between the jobs.
 */
describe("CI Gate Ordering", () => {
  const ciPath = path.join(process.cwd(), ".github/workflows/ci.yml");
  const ci = fs.readFileSync(ciPath, "utf8");
  const lines = ci.split("\n");

  /** Index of the first line whose text contains the marker, or -1. */
  const stepIndex = (marker: string): number =>
    lines.findIndex((line) => line.includes(marker));

  /** Index of the first line that is exactly the marker once trimmed. */
  const exactLineIndex = (marker: string): number =>
    lines.findIndex((line) => line.trim() === marker);

  /** Index of the line declaring a top-level job (2-space indent). */
  const jobIndex = (job: string): number =>
    lines.findIndex((line) => line === `  ${job}:`);

  /** Raw text of one job block, from its header to the next job header. */
  const jobBlock = (job: string): string => {
    const start = jobIndex(job);
    if (start === -1) return "";
    const end = lines.findIndex(
      (line, index) => index > start && /^ {2}[a-z][a-z0-9-]*:$/.test(line)
    );
    return lines.slice(start, end === -1 ? lines.length : end).join("\n");
  };

  /** The jobs a job lists under `needs:` (inline or as a flow sequence). */
  const needsOf = (job: string): string[] => {
    const block = jobBlock(job);
    const match = block.match(/^ {4}needs:\s*([\s\S]*?)\n {4}[a-z-]+:/m);
    if (!match) return [];
    return match[1]
      .replace(/[[\]\s]/g, "")
      .split(",")
      .filter(Boolean);
  };

  /** Every job reachable through `needs:` from the given job. */
  const ancestorsOf = (job: string, seen = new Set<string>()): Set<string> => {
    for (const dependency of needsOf(job)) {
      if (!seen.has(dependency)) {
        seen.add(dependency);
        ancestorsOf(dependency, seen);
      }
    }
    return seen;
  };

  /** The job whose block contains the exact line `run: <command>`. */
  const jobRunning = (command: string): string | undefined => {
    const runLine = new RegExp(
      `^\\s+run: ${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
      "m"
    );
    return lines
      .filter((line) => /^ {2}[a-z][a-z0-9-]*:$/.test(line))
      .map((line) => line.trim().replace(/:$/, ""))
      .find((job) => runLine.test(jobBlock(job)));
  };

  it("runs the production build before the invariant verification", () => {
    const build = exactLineIndex("run: npm run build");
    // The full verify, not the static gate's early pass without bench
    // evidence (`npm run verify -- --skip-benchmark-evidence`).
    const verify = exactLineIndex("run: npm run verify");

    expect(build).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(build);

    const verifyJob = jobRunning("npm run verify");
    expect(verifyJob).toBe("bench-gate");
    expect(ancestorsOf(verifyJob!).has("build")).toBe(true);
  });

  it("produces benchmark evidence before the invariant verification reads it", () => {
    const bench = stepIndex("npm run bench:pages -- --assert");
    const verify = exactLineIndex("run: npm run verify");

    expect(bench).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(bench);

    const benchJob = jobRunning("npm run bench:pages -- --assert");
    expect(benchJob).toBe("bench-gate");
    // Same job, so the evidence verify reads was written on this runner
    // moments earlier; no shard or queue time can age it past 15 minutes.
    expect(jobRunning("npm run verify")).toBe(benchJob);
    const block = jobBlock("bench-gate");
    expect(block.indexOf("run: npm run verify")).toBeGreaterThan(
      block.indexOf("npm run bench:pages -- --assert")
    );
    expect(ancestorsOf("heavy-gate-report").has("bench-gate")).toBe(true);
  });

  it("keeps the quality script ordered the same way as CI", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    const quality = pkg.scripts.quality;
    expect(quality).toContain("bench:pages");
    expect(quality).toContain("verify");
    expect(quality.indexOf("bench:pages")).toBeLessThan(
      quality.lastIndexOf("verify")
    );
  });

  it("builds with the same entrypoint production uses", () => {
    // Vercel runs `npm run build` -> scripts/build.js -> `next build --webpack`.
    // A bare `npx next build` picks Turbopack on Next 16, which does not
    // complete for this app, so CI must not diverge from the shipped path.
    expect(ci).toContain("npm run build");
    expect(ci).not.toMatch(/^\s*(run:\s*)?npx next build\s*$/m);

    const buildScript = fs.readFileSync(
      path.join(process.cwd(), "scripts/build.js"),
      "utf8"
    );
    expect(buildScript).toContain("--webpack");
  });

  it("keeps the benchmark evidence directory untracked", () => {
    const gitignore = fs.readFileSync(
      path.join(process.cwd(), ".gitignore"),
      "utf8"
    );
    // The SLA check rejects evidence gathered from a dirty tree, so the
    // artifacts the pipeline writes must never show up in git status.
    expect(gitignore).toMatch(/^\/?\.benchmark-results\/?$/m);
    expect(gitignore).toMatch(/^\/?\.next\/?$/m);
    expect(gitignore).toMatch(/^\/?playwright-report\/?$/m);
  });

  /**
   * #1769: the PR builds exactly once. Every browser job consumes the build
   * job's artifact instead of running `npm run build` again, and the bench
   * no longer rebuilds because it validates the build's provenance.
   */
  describe("one production build per pull request (#1769)", () => {
    const buildJobs = lines
      .filter((line) => /^ {2}[a-z][a-z0-9-]*:$/.test(line))
      .map((line) => line.trim().replace(/:$/, ""))
      .filter((job) => /run: npm run build\s*$/m.test(jobBlock(job)));

    it("runs npm run build only in the build job, cache-warm, and the manual matrix", () => {
      expect(buildJobs.sort()).toEqual(
        ["build", "cache-warm", "cross-device-matrix"].sort()
      );
    });

    it("gates the build on the static checks", () => {
      expect(needsOf("build")).toEqual(
        expect.arrayContaining(["changes", "static-gate"])
      );
    });

    it.each(["heavy-gate", "bench-gate", "device-gate"])(
      "%s downloads the build artifact and depends on the build job",
      (job) => {
        const block = jobBlock(job);
        expect(block).toMatch(/uses: actions\/download-artifact@/);
        expect(block).toMatch(/name: production-build/);
        expect(ancestorsOf(job).has("build")).toBe(true);
      }
    );

    it("uploads the build output without its cache or any env file", () => {
      const block = jobBlock("build");
      const upload = block.slice(block.indexOf("Upload Production Build"));
      expect(upload).toMatch(/uses: actions\/upload-artifact@/);
      expect(upload).toMatch(/name: production-build/);
      expect(upload).toMatch(/^\s+\.next\/$/m);
      expect(upload).toMatch(/^\s+!\.next\/cache\/$/m);
      expect(upload).toMatch(/^\s+!\*\*\/\.env\*$/m);
      expect(upload).toMatch(/include-hidden-files: true/);
      expect(upload).toMatch(/retention-days: 1\b/);
      expect(upload).not.toMatch(/^\s+\.env/m);
    });

    it("keeps the bundle budget check on the build that ships", () => {
      const block = jobBlock("build");
      expect(
        block.indexOf("npm run analyze:bundle -- --strict")
      ).toBeGreaterThan(block.indexOf("run: npm run build"));
    });

    it("keeps the dummy database URL on every build and server step", () => {
      for (const job of [
        ...buildJobs,
        "heavy-gate",
        "bench-gate",
        "device-gate",
      ]) {
        const block = jobBlock(job);
        const urls = [...block.matchAll(/DATABASE_URL:\s*"([^"]+)"/g)].map(
          (m) => m[1]
        );
        expect(urls.length, `${job} sets DATABASE_URL`).toBeGreaterThan(0);
        for (const url of urls) {
          expect(url).toBe("postgresql://dummy:dummy@127.0.0.1:59999/dummy");
        }
      }
    });
  });

  /**
   * #1770: chromium Playwright runs as three shards with blob reports that a
   * summary job merges, so the accessibility report and the health dashboard
   * read one result.
   */
  describe("sharded chromium Playwright (#1770)", () => {
    const heavy = jobBlock("heavy-gate");

    it("runs the same chromium project in three shards with blob reports", () => {
      expect(heavy).toMatch(/shard: \[1, 2, 3\]/);
      expect(heavy).toMatch(
        /playwright test --project=chromium --shard=\$\{\{ matrix\.shard \}\}\/3 --reporter=github,blob/
      );
      expect(heavy).toMatch(/fail-fast: false/);
    });

    it("keeps the configured workers and retries rather than overriding them", () => {
      expect(heavy).not.toMatch(/--workers|--retries|-j\s/);
      const config = fs.readFileSync(
        path.join(process.cwd(), "playwright.config.ts"),
        "utf8"
      );
      expect(config).toContain("retries: process.env.CI ? 2 : 0");
      expect(config).toContain("workers: process.env.CI ? 2 : undefined");
    });

    it("merges every shard before the accessibility report and the doctor's scan check", () => {
      const report = jobBlock("heavy-gate-report");
      expect(needsOf("heavy-gate-report")).toEqual(
        expect.arrayContaining(["heavy-gate", "bench-gate", "build"])
      );
      expect(report).toMatch(/if: \$\{\{ always\(\) &&/);
      const merge = report.indexOf("playwright merge-reports");
      const flaky = report.indexOf("report-playwright-flaky.js");
      const verify = report.indexOf(
        "run: npm run verify -- --skip-benchmark-evidence"
      );
      const a11y = report.indexOf("generate-accessibility-report.js");
      expect(merge).toBeGreaterThan(-1);
      expect(flaky).toBeGreaterThan(merge);
      expect(verify).toBeGreaterThan(flaky);
      expect(a11y).toBeGreaterThan(merge);
    });

    it("fails the summary when any shard or the bench did not succeed, or on any WCAG violation", () => {
      const report = jobBlock("heavy-gate-report");
      expect(report).toContain(
        'if [ "${{ needs.heavy-gate.result }}" != "success" ]; then'
      );
      expect(report).toContain(
        'if [ "${{ needs.bench-gate.result }}" != "success" ]; then'
      );
      expect(report).toContain('if [ "$ACC_STATUS" != "✅ Pass" ]; then');
    });

    it("collects every shard's accessibility scans for the merged report", () => {
      expect(heavy).toMatch(/path: playwright-report\/accessibility-results\//);
      expect(jobBlock("heavy-gate-report")).toMatch(
        /pattern: playwright-a11y-\*\n\s+path: playwright-report\/accessibility-results\n\s+merge-multiple: true/
      );
    });
  });

  /**
   * CI-02: `merge-gate` is the single required-status-check job, and it must
   * physically depend (`needs:`) on every job that gates a merge. GitHub only
   * schedules `merge-gate` once its `needs:` predecessors have finished, so
   * this ordering is what makes "wait for every required job's real result"
   * possible at all.
   */
  describe("Merge Gate Dependency Ordering", () => {
    const GATES = [
      "changes",
      "static-gate",
      "unit-gate",
      "unit-coverage",
      "mutation-gate",
      "security-gate",
      "build",
      "heavy-gate",
      "bench-gate",
      "heavy-gate-report",
      "device-gate",
    ];

    it("declares every gating job before merge-gate", () => {
      const mergeGate = jobIndex("merge-gate");
      expect(mergeGate).toBeGreaterThan(-1);

      for (const predecessor of GATES) {
        const index = jobIndex(predecessor);
        expect(index, `expected a "${predecessor}:" job block`).toBeGreaterThan(
          -1
        );
        expect(index).toBeLessThan(mergeGate);
      }
    });

    it("lists merge-gate's needs so every gating job is included", () => {
      expect(needsOf("merge-gate").sort()).toEqual([...GATES].sort());
    });

    it("never lets the browser gates start before the static checks pass", () => {
      for (const job of ["heavy-gate", "bench-gate", "device-gate"]) {
        expect(ancestorsOf(job).has("static-gate")).toBe(true);
      }
    });

    it("keeps device-gate's build download before its device-specific Playwright run", () => {
      const block = jobBlock("device-gate");
      const download = block.indexOf("name: production-build");
      const playwright = block.indexOf(
        "__tests__/e2e/visual.spec.ts __tests__/e2e/touch-controls.spec.ts"
      );

      expect(download).toBeGreaterThan(-1);
      expect(playwright).toBeGreaterThan(download);
    });
  });

  /**
   * #954: `__tests__/mermaid-corpus.test.ts` renders the Mermaid corpus in a
   * real Chromium (`validateCorpus` -> `launchChromiumWithFallback`). The
   * unit shards run that suite, and which shard gets it depends on the split,
   * so every shard runs in the Playwright image that ships Chromium (#1771).
   */
  describe("Unit Gate browser provisioning", () => {
    const block = jobBlock("unit-gate");

    it("runs every Vitest shard in the pinned Playwright image", () => {
      expect(block).toMatch(
        /^ {4}container:\n {6}image: mcr\.microsoft\.com\/playwright:v[\d.]+-noble@sha256:[0-9a-f]{64}\n/m
      );
      expect(block.indexOf("container:")).toBeLessThan(
        block.indexOf("run: npm run test:ci:shard")
      );
    });

    it("never downloads browsers or runs apt itself", () => {
      expect(block).not.toMatch(/playwright install/);
      expect(block).not.toMatch(/ms-playwright/);
    });

    // The Playwright image has no unzip, and the extract-zip remediation
    // test runs the real binary, so the runner's copy is mounted in.
    it("mounts the runner's unzip for the extract-zip remediation test", () => {
      expect(block).toContain("- /usr/bin/unzip:/usr/local/bin/unzip:ro");
    });
  });

  /**
   * #1775: the unit suite runs as three shards; one follow-up job merges
   * their blobs and enforces the vitest.config.ts thresholds on the result.
   */
  describe("sharded Vitest with merged coverage (#1775)", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    it("shards the suite three ways with blob reports and coverage", () => {
      const block = jobBlock("unit-gate");
      expect(block).toMatch(/shard: \[1, 2, 3\]/);
      expect(block).toContain(
        "run: npm run test:ci:shard -- --shard=${{ matrix.shard }}/3"
      );
      expect(pkg.scripts["test:ci:shard"]).toBe(
        "VITE_CONFIG_NATIVE_IGNORE_WARNING=1 VITEST_COVERAGE_THRESHOLDS=deferred-to-merge vitest run --coverage --reporter=blob --reporter=github-actions --reporter=dot"
      );
      expect(block).toMatch(/name: vitest-blob-\$\{\{ matrix\.shard \}\}/);
    });

    // A blob report alone prints nothing on failure, so a red shard said
    // only "exit code 1". The shard also names its failing tests in the log
    // and as annotations.
    it("names failing tests in the shard log, not only in the blob", () => {
      expect(pkg.scripts["test:ci:shard"]).toMatch(/--reporter=github-actions/);
      expect(pkg.scripts["test:ci:shard"]).toMatch(/--reporter=dot/);
    });

    it("merges the shards and enforces thresholds without deferring them", () => {
      const block = jobBlock("unit-coverage");
      expect(needsOf("unit-coverage")).toContain("unit-gate");
      expect(block).toMatch(/if: \$\{\{ always\(\) &&/);
      expect(block).toContain("run: npm run test:ci:merge");
      expect(block).not.toContain("VITEST_COVERAGE_THRESHOLDS");
      expect(pkg.scripts["test:ci:merge"]).toBe(
        "VITE_CONFIG_NATIVE_IGNORE_WARNING=1 vitest --merge-reports --coverage"
      );
      expect(pkg.scripts["test:ci"]).toBe(
        "VITE_CONFIG_NATIVE_IGNORE_WARNING=1 vitest run --coverage"
      );
    });

    it("defers thresholds only when a shard asks, and keeps them otherwise", async () => {
      const load = async (value: string | undefined) => {
        const previous = process.env.VITEST_COVERAGE_THRESHOLDS;
        if (value === undefined) delete process.env.VITEST_COVERAGE_THRESHOLDS;
        else process.env.VITEST_COVERAGE_THRESHOLDS = value;
        try {
          vi.resetModules();
          const mod = (await import("../vitest.config")) as {
            default: {
              test: { coverage: { thresholds?: Record<string, unknown> } };
            };
          };
          return mod.default.test.coverage.thresholds;
        } finally {
          if (previous === undefined)
            delete process.env.VITEST_COVERAGE_THRESHOLDS;
          else process.env.VITEST_COVERAGE_THRESHOLDS = previous;
        }
      };

      const enforced = await load(undefined);
      expect(enforced).toMatchObject({
        "lib/**": { lines: 80, functions: 80, statements: 80, branches: 70 },
        "lib/trial-and-error/**": { statements: 95 },
      });
      expect(await load("deferred-to-merge")).toBeUndefined();
      expect(await load("anything-else")).toEqual(enforced);
    });
  });
});
