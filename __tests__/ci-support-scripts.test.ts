// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  BENCHMARK_EVIDENCE_CHECK_ID,
  withoutBenchmarkEvidenceCheck,
} from "../scripts/dx";
import { buildStrykerArgs } from "../scripts/run-mutation-tests";
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
