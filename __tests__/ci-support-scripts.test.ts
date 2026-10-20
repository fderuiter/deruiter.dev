// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  BENCHMARK_EVIDENCE_CHECK_ID,
  withoutBenchmarkEvidenceCheck,
} from "../scripts/dx";
import {
  buildStrykerArgs,
  fileBreakFailures,
  fileScores,
} from "../scripts/run-mutation-tests";
import type { DiagnosticSummary } from "../lib/dx/doctor";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const flaky = require("../scripts/report-playwright-flaky.js") as {
  collectFlakyTests: (report: unknown) => Array<{
    title: string;
    file: string;
    attempts: number;
  }>;
  main: (argv: string[]) => number;
};

/** Support scripts the #1767 CI jobs call. */
describe("CI support scripts (#1767)", () => {
  describe("verify --skip-benchmark-evidence", () => {
    const summary = (
      results: Array<{ id: string; status: "pass" | "fail" | "warn" }>
    ): DiagnosticSummary => ({
      results: results.map((r) => ({
        ...r,
        name: r.id,
        category: "quality",
        message: r.id,
      })),
      hasFailures: results.some((r) => r.status === "fail"),
      hasWarnings: results.some((r) => r.status === "warn"),
      totalPassed: results.filter((r) => r.status === "pass").length,
      totalFailed: results.filter((r) => r.status === "fail").length,
      totalWarned: results.filter((r) => r.status === "warn").length,
      totalFixed: 0,
      remediations: [],
    });

    it("drops only the benchmark evidence check", () => {
      const filtered = withoutBenchmarkEvidenceCheck(
        summary([
          { id: BENCHMARK_EVIDENCE_CHECK_ID, status: "fail" },
          { id: "docs-parity", status: "pass" },
        ])
      );
      expect(filtered.results.map((r) => r.id)).toEqual(["docs-parity"]);
      expect(filtered.hasFailures).toBe(false);
      expect(filtered.totalFailed).toBe(0);
      expect(filtered.totalPassed).toBe(1);
    });

    it("still fails on any other failing or warning check", () => {
      const filtered = withoutBenchmarkEvidenceCheck(
        summary([
          { id: BENCHMARK_EVIDENCE_CHECK_ID, status: "fail" },
          { id: "docs-parity", status: "fail" },
          { id: "hydration", status: "warn" },
        ])
      );
      expect(filtered.hasFailures).toBe(true);
      expect(filtered.hasWarnings).toBe(true);
      expect(filtered.totalFailed).toBe(1);
    });

    it("names the check the doctor actually emits", () => {
      const doctor = fs.readFileSync(
        path.join(process.cwd(), "lib/dx/doctor.ts"),
        "utf8"
      );
      expect(doctor).toContain(`id: "${BENCHMARK_EVIDENCE_CHECK_ID}"`);
    });
  });

  describe("mutation gate arguments", () => {
    it("runs every mutant by default", () => {
      expect(buildStrykerArgs([])).toEqual(["run"]);
    });

    it("passes --incremental and --force through", () => {
      expect(buildStrykerArgs(["--incremental"])).toEqual([
        "run",
        "--incremental",
      ]);
      expect(buildStrykerArgs(["--incremental", "--force"])).toEqual([
        "run",
        "--incremental",
        "--force",
      ]);
    });

    it("treats --force alone as the full run it already is", () => {
      expect(buildStrykerArgs(["--force"])).toEqual(["run"]);
    });

    it("rejects anything that could change thresholds or scope", () => {
      expect(() => buildStrykerArgs(["--thresholds.break", "0"])).toThrow(
        /Unknown mutation gate option/
      );
      expect(() => buildStrykerArgs(["--mutate", "lib/x.ts"])).toThrow();
    });

    it("runs the weekly engine scope from its own config (#2529)", () => {
      expect(buildStrykerArgs(["--engines"])).toEqual([
        "run",
        "stryker.engines.config.mjs",
      ]);
      expect(buildStrykerArgs(["--engines", "--incremental"])).toEqual([
        "run",
        "stryker.engines.config.mjs",
        "--incremental",
      ]);
      expect(buildStrykerArgs(["--force", "--engines"])).toEqual([
        "run",
        "stryker.engines.config.mjs",
      ]);
    });
  });

  describe("per-file mutation breaks (#2529)", () => {
    const mutants = (statuses: string[]) => ({
      mutants: statuses.map((status) => ({ status })),
    });
    const report = {
      files: {
        "lib/a.ts": mutants(["Killed", "Timeout", "Survived", "NoCoverage"]),
        "lib/b.ts": mutants(["Killed", "CompileError", "Ignored"]),
        "lib/c.ts": mutants(["RuntimeError"]),
      },
    };

    it("scores detected over valid mutants, as Stryker does", () => {
      expect(fileScores(report)).toEqual({
        "lib/a.ts": 50,
        "lib/b.ts": 100,
        "lib/c.ts": 100,
      });
    });

    it("fails a file below its break or missing from the report", () => {
      const scores = fileScores(report);
      expect(fileBreakFailures(scores, { "lib/a.ts": 50 })).toEqual([]);
      expect(fileBreakFailures(scores, { "lib/a.ts": 51 })).toEqual([
        "lib/a.ts: 50.00% is below its break of 51%",
      ]);
      expect(fileBreakFailures(scores, { "lib/z.ts": 0 })).toEqual([
        "lib/z.ts: not in the report",
      ]);
    });

    it("never lets an engine floor sit at zero once measured", async () => {
      const { fileBreaks } = (await import(
        path.join(process.cwd(), "stryker.engines.config.mjs")
      )) as { fileBreaks: Record<string, number> };
      expect(Object.keys(fileBreaks).length).toBeGreaterThan(0);
      for (const [file, floor] of Object.entries(fileBreaks)) {
        expect(fs.existsSync(path.join(process.cwd(), file)), file).toBe(true);
        expect(floor, file).toBeGreaterThan(0);
      }
    });
  });

  describe("flaky Playwright report", () => {
    const report = {
      stats: { expected: 2, unexpected: 0, flaky: 1, skipped: 0 },
      suites: [
        {
          title: "a.spec.ts",
          file: "a.spec.ts",
          specs: [
            {
              title: "stable",
              file: "a.spec.ts",
              line: 3,
              tests: [{ status: "expected", results: [{}] }],
            },
          ],
          suites: [
            {
              title: "group",
              specs: [
                {
                  title: "retried",
                  file: "a.spec.ts",
                  line: 9,
                  tests: [
                    {
                      status: "flaky",
                      projectName: "chromium",
                      results: [{}, {}],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    it("lists tests that passed only on retry, including nested suites", () => {
      expect(flaky.collectFlakyTests(report)).toEqual([
        expect.objectContaining({
          title: "a.spec.ts › group › retried",
          file: "a.spec.ts",
          attempts: 2,
        }),
      ]);
    });

    it("passes with a valid report and fails when the merged report is missing or empty", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flaky-report-"));
      try {
        const good = path.join(dir, "good.json");
        fs.writeFileSync(good, JSON.stringify(report));
        const empty = path.join(dir, "empty.json");
        fs.writeFileSync(empty, JSON.stringify({ stats: {}, suites: [] }));
        const previous = process.env.GITHUB_STEP_SUMMARY;
        process.env.GITHUB_STEP_SUMMARY = path.join(dir, "summary.md");
        try {
          expect(flaky.main([good])).toBe(0);
          expect(flaky.main([empty])).toBe(1);
          expect(flaky.main([path.join(dir, "missing.json")])).toBe(1);
          expect(
            fs.readFileSync(process.env.GITHUB_STEP_SUMMARY, "utf8")
          ).toContain("retried");
        } finally {
          if (previous === undefined) delete process.env.GITHUB_STEP_SUMMARY;
          else process.env.GITHUB_STEP_SUMMARY = previous;
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
