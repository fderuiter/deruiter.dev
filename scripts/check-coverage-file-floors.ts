#!/usr/bin/env node
/**
 * Per-file coverage floor (#3486, gap G1 of #2513).
 *
 * The `vitest.config.mts` thresholds are aggregates over each glob, so a
 * well-covered folder can carry a file that would fail on its own. This check
 * holds every file under the configured prefixes to a floor of its own, read
 * from the merged `coverage/coverage-summary.json`:
 *
 * - a file outside the baseline must meet the floor;
 * - a baseline file may not fall below its recorded coverage;
 * - a baseline entry whose file now meets the floor, or no longer exists, is
 *   stale and must be removed, so the baseline only shrinks.
 *
 * The floors and the baseline live in `config/coverage-file-floors.json`.
 * Usage: `npx tsx scripts/check-coverage-file-floors.ts [summary.json]`.
 */
import fs from "fs";
import path from "path";

/** The two metrics the floor applies to, as Istanbul names them. */
export type FloorMetric = "statements" | "branches";

/** Coverage of one metric of one file, as `json-summary` writes it. */
interface MetricSummary {
  readonly total: number;
  readonly covered: number;
  readonly pct: number;
}

/** `coverage-summary.json`: one entry per absolute file path, plus `total`. */
export type CoverageSummary = Readonly<
  Record<string, Readonly<Record<FloorMetric, MetricSummary>>>
>;

/** `config/coverage-file-floors.json`. */
export interface FileFloorConfig {
  /** Path prefixes, relative to the repository root, the floor applies to. */
  readonly include: readonly string[];
  readonly floor: Readonly<Record<FloorMetric, number>>;
  /** Files below the floor when the check landed, at their coverage then. */
  readonly baseline: Readonly<
    Record<string, Readonly<Record<FloorMetric, number>>>
  >;
}

const METRICS: readonly FloorMetric[] = ["statements", "branches"];

/**
 * Coverage of a file for one metric. A file with nothing to cover of a kind
 * (no branches, say) counts as fully covered for it.
 */
function percent(metric: MetricSummary): number {
  return metric.total === 0 ? 100 : metric.pct;
}

/**
 * Every violation of the per-file floor, one line each, in file order.
 *
 * @param summary - The merged coverage summary.
 * @param config - The floors and the baseline.
 * @param root - The absolute root the summary's paths start with.
 */
export function fileFloorFailures(
  summary: CoverageSummary,
  config: FileFloorConfig,
  root: string
): string[] {
  const prefix = root.endsWith("/") ? root : `${root}/`;
  const files = new Map<string, Readonly<Record<FloorMetric, MetricSummary>>>();
  for (const [file, metrics] of Object.entries(summary)) {
    if (file === "total") continue;
    const relative = file.startsWith(prefix) ? file.slice(prefix.length) : file;
    if (config.include.some((include) => relative.startsWith(include))) {
      files.set(relative.split(path.sep).join("/"), metrics);
    }
  }

  const failures: string[] = [];
  for (const [file, metrics] of [...files].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const recorded = config.baseline[file];
    for (const metric of METRICS) {
      const actual = percent(metrics[metric]);
      if (recorded) {
        if (actual < recorded[metric]) {
          failures.push(
            `${file}: ${metric} ${actual.toFixed(2)}% fell below its baseline of ${recorded[metric]}%.`
          );
        }
      } else if (actual < config.floor[metric]) {
        failures.push(
          `${file}: ${metric} ${actual.toFixed(2)}% is below the per-file floor of ${config.floor[metric]}%.`
        );
      }
    }
    if (
      recorded &&
      METRICS.every(
        (metric) => percent(metrics[metric]) >= config.floor[metric]
      )
    ) {
      failures.push(
        `${file}: meets the floor now; remove its entry from the baseline.`
      );
    }
  }
  for (const file of Object.keys(config.baseline).sort()) {
    if (!files.has(file)) {
      failures.push(
        `${file}: has no coverage entry (moved or deleted); remove it from the baseline.`
      );
    }
  }
  return failures;
}

/** Reads the summary and the config, and exits 1 on any failure. */
export function main(argv: readonly string[] = process.argv.slice(2)): void {
  const root = process.cwd();
  const summaryPath = path.resolve(
    root,
    argv[0] ?? "coverage/coverage-summary.json"
  );
  const configPath = path.resolve(root, "config/coverage-file-floors.json");
  const summary = JSON.parse(
    fs.readFileSync(summaryPath, "utf8")
  ) as CoverageSummary;
  const config = JSON.parse(
    fs.readFileSync(configPath, "utf8")
  ) as FileFloorConfig;
  const failures = fileFloorFailures(summary, config, root);
  if (failures.length > 0) {
    console.error(
      `Per-file coverage floor (${config.floor.statements}% statements, ${config.floor.branches}% branches) failed:\n${failures
        .map((line) => `  ${line}`)
        .join("\n")}\nThe rules are in config/coverage-file-floors.json.`
    );
    process.exit(1);
  }
  console.log(
    `Per-file coverage floor passed: every file under ${config.include.join(", ")} meets ${config.floor.statements}% statements and ${config.floor.branches}% branches, or its baseline.`
  );
}

if (require.main === module) {
  main();
}
