import { describe, it, expect } from "vitest";
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
 */
describe("CI Gate Ordering", () => {
  const ciPath = path.join(process.cwd(), ".github/workflows/ci.yml");
  const ci = fs.readFileSync(ciPath, "utf8");

  /** Index of the first line whose text contains the marker, or -1. */
  const stepIndex = (marker: string): number =>
    ci.split("\n").findIndex((line) => line.includes(marker));

  it("runs the production build before the invariant verification", () => {
    const build = stepIndex("npm run build");
    const verify = stepIndex("npm run verify");

    expect(build).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(build);
  });

  it("produces benchmark evidence before the invariant verification reads it", () => {
    const bench = stepIndex("npm run bench:pages -- --assert");
    const verify = stepIndex("npm run verify");

    expect(bench).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(bench);
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
  });

  /**
   * CI-02: `merge-gate` is the single required-status-check job, and it must
   * physically depend (`needs:`) on every job that gates a merge. GitHub only
   * schedules `merge-gate` once its `needs:` predecessors have finished, so
   * this ordering is what makes "wait for every required job's real result"
   * possible at all -- get the job order or the `needs:` graph wrong and the
   * summary step can run (and pass) before the jobs it is meant to police.
   */
  describe("Merge Gate Dependency Ordering", () => {
    /** Index of the line declaring a top-level job (2-space indent). */
    const jobIndex = (job: string): number =>
      ci.split("\n").findIndex((line) => line === `  ${job}:`);

    it("declares fast-gate, security-gate, heavy-gate, and device-gate before merge-gate", () => {
      const mergeGate = jobIndex("merge-gate");
      expect(mergeGate).toBeGreaterThan(-1);

      for (const predecessor of [
        "fast-gate",
        "security-gate",
        "heavy-gate",
        "device-gate",
      ]) {
        const index = jobIndex(predecessor);
        expect(index, `expected a "${predecessor}:" job block`).toBeGreaterThan(
          -1
        );
        expect(index).toBeLessThan(mergeGate);
      }
    });

    it("lists merge-gate's needs so every gating job is included", () => {
      const start = jobIndex("merge-gate");
      const end = jobIndex("cross-device-matrix");
      const lines = ci.split("\n");
      const block = lines.slice(start, end).join("\n");

      expect(block).toMatch(
        /needs:\s*\[fast-gate,\s*security-gate,\s*heavy-gate,\s*device-gate\]/
      );
    });

    it("keeps device-gate's own build before its device-specific Playwright run", () => {
      const start = jobIndex("device-gate");
      const end = jobIndex("merge-gate");
      const lines = ci.split("\n");
      const block = lines.slice(start, end).join("\n");

      const build = block.indexOf("npm run build");
      const playwright = block.indexOf(
        "__tests__/e2e/visual.spec.ts __tests__/e2e/touch-controls.spec.ts"
      );

      expect(build).toBeGreaterThan(-1);
      expect(playwright).toBeGreaterThan(-1);
      expect(playwright).toBeGreaterThan(build);
    });
  });

  /**
   * #954: `__tests__/mermaid-corpus.test.ts` renders the Mermaid corpus in a
   * real Chromium (`validateCorpus` -> `launchChromiumWithFallback`). The
   * Fast Gate runs that suite through `npm run test:ci`, so it must provision
   * Chromium before the Vitest step, the same cached way the Heavy Gate does.
   */
  describe("Fast Gate browser provisioning", () => {
    const lines = ci.split("\n");
    const start = lines.findIndex((line) => line === "  fast-gate:");
    const end = lines.findIndex(
      (line, index) => index > start && /^ {2}[a-z-]+:$/.test(line)
    );
    const block = lines.slice(start, end).join("\n");

    it("installs Chromium before the Vitest step that renders the Mermaid corpus", () => {
      const vitest = block.indexOf("run: npm run test:ci");
      const install = block.indexOf(
        "npx --no-install playwright install chromium --with-deps"
      );
      const depsOnly = block.indexOf(
        "npx --no-install playwright install-deps chromium"
      );

      expect(vitest).toBeGreaterThan(-1);
      expect(install, "fast-gate must install Chromium").toBeGreaterThan(-1);
      expect(install).toBeLessThan(vitest);
      expect(
        depsOnly,
        "a cache hit still needs host dependencies"
      ).toBeGreaterThan(-1);
      expect(depsOnly).toBeLessThan(vitest);
    });

    it("reuses the branch-scoped Chromium browser cache", () => {
      expect(block).toMatch(/path:\s*~\/\.cache\/ms-playwright/);
      expect(block).toMatch(
        /key:\s*playwright-chromium-\$\{\{\s*github\.head_ref\s*\|\|\s*github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
      );
    });
  });
});
