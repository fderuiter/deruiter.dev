// @vitest-environment node
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
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
  formatAnnotation: (test: FlakyTest) => string;
  formatSummaryRow: (test: FlakyTest) => string;
  main: (argv: string[]) => number;
};

interface FlakyTest {
  title: string;
  file: string;
  line: number;
  attempts: number;
}

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
    const BASE = "config/stryker/stryker.config.mjs";

    it("runs every mutant by default", () => {
      expect(buildStrykerArgs([])).toEqual(["run", BASE]);
    });

    it("passes --incremental and --force through", () => {
      expect(buildStrykerArgs(["--incremental"])).toEqual([
        "run",
        BASE,
        "--incremental",
      ]);
      expect(buildStrykerArgs(["--incremental", "--force"])).toEqual([
        "run",
        BASE,
        "--incremental",
        "--force",
      ]);
    });

    it("treats --force alone as the full run it already is", () => {
      expect(buildStrykerArgs(["--force"])).toEqual(["run", BASE]);
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
        "config/stryker/stryker.engines.config.mjs",
      ]);
      expect(buildStrykerArgs(["--engines", "--incremental"])).toEqual([
        "run",
        "config/stryker/stryker.engines.config.mjs",
        "--incremental",
      ]);
      expect(buildStrykerArgs(["--force", "--engines"])).toEqual([
        "run",
        "config/stryker/stryker.engines.config.mjs",
      ]);
    });

    it("runs the weekly Garmin scope from its own config (#2564)", () => {
      expect(buildStrykerArgs(["--garmin"])).toEqual([
        "run",
        "config/stryker/stryker.garmin.config.mjs",
      ]);
      expect(buildStrykerArgs(["--garmin", "--incremental"])).toEqual([
        "run",
        "config/stryker/stryker.garmin.config.mjs",
        "--incremental",
      ]);
      expect(() => buildStrykerArgs(["--engines", "--garmin"])).toThrow(
        /Pick one mutation scope/
      );
    });

    it("runs the weekly study data scope from its own config (#2607)", () => {
      expect(buildStrykerArgs(["--study-data"])).toEqual([
        "run",
        "config/stryker/stryker.study-data.config.mjs",
      ]);
      expect(() => buildStrykerArgs(["--garmin", "--study-data"])).toThrow(
        /Pick one mutation scope/
      );
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

    it.each([
      "config/stryker/stryker.engines.config.mjs",
      "config/stryker/stryker.garmin.config.mjs",
      "config/stryker/stryker.study-data.config.mjs",
    ])("never lets a %s floor sit at zero once measured", async (config) => {
      const { fileBreaks } = (await import(
        path.join(process.cwd(), config)
      )) as { fileBreaks: Record<string, number> };
      expect(Object.keys(fileBreaks).length).toBeGreaterThan(0);
      for (const [file, floor] of Object.entries(fileBreaks)) {
        expect(fs.existsSync(path.join(process.cwd(), file)), file).toBe(true);
        expect(floor, file).toBeGreaterThan(0);
      }
    });

    it("keeps the weekly scopes' files and reports apart (#2564, #2607)", async () => {
      const load = async (config: string) =>
        (await import(path.join(process.cwd(), config))) as {
          fileBreaks: Record<string, number>;
          ENGINES_JSON_REPORT: string;
          default: { incrementalFile: string };
        };
      const scopes = await Promise.all(
        [
          "config/stryker/stryker.engines.config.mjs",
          "config/stryker/stryker.garmin.config.mjs",
          "config/stryker/stryker.study-data.config.mjs",
        ].map(load)
      );
      const files = scopes.flatMap((scope) => Object.keys(scope.fileBreaks));
      expect(new Set(files).size).toBe(files.length);
      const reports = scopes.map((scope) => scope.ENGINES_JSON_REPORT);
      expect(new Set(reports).size).toBe(scopes.length);
      const incremental = scopes.map((scope) => scope.default.incrementalFile);
      expect(new Set(incremental).size).toBe(scopes.length);
    });
  });

  describe("weekly study data mutation shards", () => {
    const config = path.join(
      process.cwd(),
      "config/stryker/stryker.study-data.config.mjs"
    );
    /** The config as a fresh process loads it with one layer named. */
    const load = (layer: string) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `const m = await import(${JSON.stringify(
              `file://${config}`
            )}); console.log(JSON.stringify({ layers: m.STUDY_DATA_LAYERS, files: Object.keys(m.fileBreaks), mutate: m.default.mutate, report: m.ENGINES_JSON_REPORT, incremental: m.default.incrementalFile }));`,
          ],
          {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, STRYKER_STUDY_DATA_LAYER: layer },
          }
        )
      ) as {
        layers: string[];
        files: string[];
        mutate: string[];
        report: string;
        incremental: string;
      };

    it("splits every floor between the layers, once each (#2607)", () => {
      const all = load("");
      const shards = all.layers.map(load);
      const sharded = shards.flatMap((shard) => shard.files);
      expect(sharded.sort()).toEqual([...all.files].sort());
      all.layers.forEach((layer, index) => {
        const shard = shards[index];
        expect(shard.files.length, layer).toBeGreaterThan(0);
        expect(shard.mutate).toEqual(shard.files);
        for (const file of shard.files) {
          expect(file).toMatch(
            new RegExp(`^lib/study-data/internal/${layer}/`)
          );
        }
      });
      const reports = [all, ...shards].map((shard) => shard.report);
      expect(new Set(reports).size).toBe(reports.length);
      const incremental = [all, ...shards].map((shard) => shard.incremental);
      expect(new Set(incremental).size).toBe(incremental.length);
    });

    it("runs one weekly job per layer", () => {
      const weekly = fs.readFileSync(
        path.join(process.cwd(), ".github/workflows/mutation-weekly.yml"),
        "utf8"
      );
      const { layers } = load("");
      expect(weekly).toContain(`layer: [${layers.join(", ")}]`);
      expect(weekly).toContain("STRYKER_STUDY_DATA_LAYER: ${{ matrix.layer }}");
      expect(weekly).toContain("fail-fast: false");
    });

    it("refuses a layer it does not know", () => {
      expect(() => load("bogus")).toThrow(/must be one of sdtm, adam, tlf/);
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

    // CodeQL alert 13: titles and paths come from the PR under test.
    const hostile: FlakyTest = {
      title: "a\\|b | c\r\n[link](https://evil.invalid) `code` <img src=x>",
      file: "e2e/a,b:c.spec.ts",
      line: 7,
      attempts: 3,
    };

    it("keeps a hostile title and path on one literal summary row", () => {
      const row = flaky.formatSummaryRow(hostile);
      expect(row).not.toMatch(/[\r\n]/);
      // Exactly the four column separators: every pipe in the data is escaped.
      expect(row.match(/(?<!\\)\|/g)).toHaveLength(4);
      expect(row).not.toContain("[link](");
      // Raw HTML and code spans only open on an unescaped delimiter.
      expect(row).not.toMatch(/(?<!\\)[<`]/);
      expect(row).toContain("\\[link\\]\\(https");
      expect(row.endsWith(" | 3 |")).toBe(true);
    });

    // The escapes are invisible once GitHub renders the summary.
    it("keeps an ordinary title readable", () => {
      expect(
        flaky.formatSummaryRow({
          title: "home loads",
          file: "e2e/home.spec.ts",
          line: 12,
          attempts: 2,
        })
      ).toBe("| home loads | e2e\\/home\\.spec\\.ts\\:12 | 2 |");
    });

    it("encodes annotations so test metadata cannot start another workflow command", () => {
      const line = flaky.formatAnnotation({
        ...hostile,
        title: "t\n::error::injected 100%",
      });
      expect(line.split("\n")).toHaveLength(1);
      expect(line).toBe(
        "::warning file=e2e/a%2Cb%3Ac.spec.ts,line=7::Passed only on retry (3 attempts): t%0A::error::injected 100%25"
      );
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
