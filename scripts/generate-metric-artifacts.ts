/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_DIMENSIONS,
  METRIC_GAPS,
  METRIC_REGISTRY,
  SYNTHETIC_DATA_NOTICE,
  buildWarehouse,
  checkMetricChange,
  describeMetricFormula,
  evaluateMetric,
  generatePortfolio,
  metricRelease,
  toMetricFlowYaml,
  toSql,
  toTmdl,
  type MetricDefinition,
  type MetricDimensionId,
  type MetricFormat,
  type MetricRelease,
  type SqlDialect,
  type Warehouse,
} from "../lib/clinical-platform";

/**
 * Writes the files generated from the Clinical Data Platform's metric
 * registry (#2624): the golden SQL per dialect, the dbt MetricFlow YAML, the
 * Power BI TMDL, the metric catalog page, and the registry lock file that
 * records every released metric contract.
 * `__tests__/clinical-platform-semantic.test.ts` regenerates each one and
 * fails when the checked-in copy differs, so run this after changing
 * `METRIC_REGISTRY` and commit the result. Writing the lock file refuses a
 * release that breaks the versioning rules, such as a changed certified
 * metric without a major version bump.
 */

/** SQL golden files, relative to the workspace root. */
export const METRIC_SQL_GOLDENS: Readonly<Record<SqlDialect, string>> = {
  duckdb: "__tests__/fixtures/clinical-platform/metrics.duckdb.sql",
  postgres: "__tests__/fixtures/clinical-platform/metrics.postgres.sql",
  tsql: "__tests__/fixtures/clinical-platform/metrics.tsql.sql",
};

/** dbt MetricFlow golden file, relative to the workspace root. */
export const METRIC_METRICFLOW_GOLDEN =
  "__tests__/fixtures/clinical-platform/metrics.metricflow.yml";

/** Power BI TMDL golden file, relative to the workspace root. */
export const METRIC_TMDL_GOLDEN =
  "__tests__/fixtures/clinical-platform/metrics.tmdl";

/** Released metric contracts, relative to the workspace root. */
export const METRIC_LOCK_FILE =
  "__tests__/fixtures/clinical-platform/metric-registry.lock.json";

/** Metric catalog page, relative to the workspace root. */
export const METRIC_REFERENCE_PAGE =
  "docs/reference/clinical-platform-metrics.md";

/** The two queries each metric is golden-filed with: its minimal grouping, then by study and one more dimension. */
export function goldenQueries(metric: MetricDefinition): MetricDimensionId[][] {
  const base: MetricDimensionId[] = metric.grain === "study" ? ["study"] : [];
  const extra = (["month", "site", "phase"] as const).find((d) =>
    metric.allowedDimensions.includes(d)
  );
  return [base, extra === undefined ? ["study"] : ["study", extra]];
}

const SQL_LABELS: Readonly<Record<SqlDialect, string>> = {
  duckdb: "DuckDB",
  postgres: "PostgreSQL",
  tsql: "SQL Server T-SQL",
};

function goldenSql(dialect: SqlDialect, dataCut: string): string {
  const queries = METRIC_REGISTRY.flatMap((metric) =>
    goldenQueries(metric).map((dims) =>
      toSql(metric, dims, [], dialect, { dataCut })
    )
  );
  return [
    `-- Clinical Data Platform governed metrics, ${SQL_LABELS[dialect]} dialect.`,
    "-- Generated from METRIC_REGISTRY in lib/clinical-platform by scripts/generate-metric-artifacts.ts; do not edit by hand.",
    `-- ${SYNTHETIC_DATA_NOTICE}`,
    "-- Each metric appears twice: at its minimal grouping, then grouped by study and one more dimension.",
    "",
    queries.join("\n\n"),
    "",
  ].join("\n");
}

function formatValue(
  value: number | null,
  format: MetricFormat,
  unit: string
): string {
  if (value === null) return "no value";
  const fixed = (n: number) => {
    const [whole, fraction] = n.toFixed(format.decimals).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
  };
  switch (format.style) {
    case "percent":
      return `${fixed(value * 100)}%`;
    case "currency":
      return `$${fixed(value)}`;
    case "number":
      return `${fixed(value)} ${unit}`;
  }
}

const cell = (text: string) => text.replaceAll("|", "\\|");

/** The value of a metric on the default seed, as the catalog shows it. */
function shownValue(warehouse: Warehouse, metric: MetricDefinition): string {
  if (metric.grain === "portfolio") {
    return formatValue(
      evaluateMetric(warehouse, metric).rows[0]?.value ?? null,
      metric.format,
      metric.unit
    );
  }
  const rows = evaluateMetric(warehouse, metric, {
    dimensions: ["study"],
  }).rows;
  return rows
    .map(
      (r) =>
        `${r.dimensions.study}: ${formatValue(r.value, metric.format, metric.unit)}`
    )
    .join("; ");
}

function referencePage(warehouse: Warehouse): string {
  const folders = [...new Set(METRIC_REGISTRY.map((m) => m.displayFolder))];
  const out: string[] = [
    "# Clinical Data Platform metric registry",
    "",
    "<!-- Generated from METRIC_REGISTRY by scripts/generate-metric-artifacts.ts. Do not edit by hand. -->",
    "",
    `${SYNTHETIC_DATA_NOTICE} Values are for the default portfolio (seed ${DEFAULT_PORTFOLIO_SEED}) at its data cut, ${warehouse.asOf}.`,
    "",
    "The governed metrics of the Clinical Data Platform",
    "([ADR 0066](../../adr/0066-clinical-data-platform-architecture.md)),",
    "each defined once in `METRIC_REGISTRY` (`lib/clinical-platform`) over the",
    "[gold star schema](clinical-platform-star-schema.md). The TypeScript",
    "evaluator behind the platform's dashboards, the SQL for DuckDB, PostgreSQL",
    "and SQL Server, the dbt MetricFlow YAML and the Power BI TMDL measures are",
    "all compiled from these definitions, and a test runs the DuckDB SQL",
    "against the TypeScript evaluator on the same data. Regenerate this page,",
    "the golden files and the registry lock with",
    "`npx tsx scripts/generate-metric-artifacts.ts`; a unit test fails when",
    "they drift.",
    "",
    "A `portfolio` metric rolls up to one value and can be grouped by any",
    "allowed dimension. A `study` metric is defined per study, so every query",
    "of it groups by study. A certified metric whose computation changes needs",
    "a major version bump, and a certified report may only use certified",
    "metrics.",
    "",
    "## Summary",
    "",
    "| Metric | Id | Status | Version | Grain | Value |",
    "| --- | --- | --- | --- | --- | --- |",
    ...METRIC_REGISTRY.map(
      (m) =>
        `| ${cell(m.name)} | \`${m.id}\` | ${m.status} | ${m.version} | ${m.grain} | ${cell(shownValue(warehouse, m))} |`
    ),
  ];
  for (const folder of folders) {
    out.push("", `## ${folder}`);
    for (const m of METRIC_REGISTRY.filter((x) => x.displayFolder === folder)) {
      const filters =
        m.defaultFilters.length === 0
          ? "none"
          : m.defaultFilters
              .map(
                (f) =>
                  `\`${f.dimension}\` ${f.operator === "in" ? "in" : "not in"} ${f.values.map((v) => `\`${v}\``).join(", ")}`
              )
              .join("; ");
      out.push(
        "",
        `### ${m.name}`,
        "",
        cell(m.description),
        "",
        `- Id: \`${m.id}\`, version ${m.version}, ${m.status}.`,
        `- Formula: ${describeMetricFormula(m)}.`,
        `- Unit: ${m.unit}. Grain: ${m.grain}.`,
        `- Dimensions: ${m.allowedDimensions.map((d) => `\`${d}\``).join(", ")}.`,
        `- Default filters: ${filters}.`,
        `- Owner: ${m.owner}. Steward: ${m.steward}.`,
        `- Glossary term: ${m.glossaryTerm === null ? "none yet" : `\`${m.glossaryTerm}\``}.`
      );
    }
  }
  out.push(
    "",
    "## Dimensions",
    "",
    "| Dimension | Id | Attribute | Description |",
    "| --- | --- | --- | --- |",
    ...METRIC_DIMENSIONS.map(
      (d) =>
        `| ${d.label} | \`${d.id}\` | \`${d.table}.${d.column}\` | ${cell(d.description)} |`
    ),
    "",
    "## Not in the registry",
    "",
    "Metrics a clinical operations or portfolio lead would expect that the",
    "gold model cannot compute yet. They are left out rather than approximated.",
    "",
    "| Metric | Why | Gold data it needs | Nearest registry metric |",
    "| --- | --- | --- | --- |",
    ...METRIC_GAPS.map(
      (g) =>
        `| ${cell(g.name)} | ${cell(g.reason)} | ${cell(g.missing)} | ${g.nearestMetricId === null ? "none" : `\`${g.nearestMetricId}\``} |`
    )
  );
  return `${out.join("\n")}\n`;
}

/** Every generated file except the lock, and its expected contents, by relative path. */
export function metricArtifacts(): Record<string, string> {
  const warehouse = buildWarehouse(
    generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
  );
  const dataCut = warehouse.asOf;
  const files: Record<string, string> = {};
  for (const [dialect, file] of Object.entries(METRIC_SQL_GOLDENS)) {
    files[file] = goldenSql(dialect as SqlDialect, dataCut);
  }
  files[METRIC_METRICFLOW_GOLDEN] = toMetricFlowYaml(METRIC_REGISTRY, {
    dataCut,
  });
  files[METRIC_TMDL_GOLDEN] = toTmdl(METRIC_REGISTRY, { dataCut });
  files[METRIC_REFERENCE_PAGE] = referencePage(warehouse);
  return files;
}

/** The registry lock file: every metric release ever recorded. */
export interface MetricLockFile {
  readonly notice: string;
  readonly releases: readonly MetricRelease[];
}

/** JSON with object keys sorted, so a release reads the same however it was built. */
function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortedJson(v)])
    );
  }
  return value;
}

/** Text of a lock file, as written to disk. */
export function lockText(lock: MetricLockFile): string {
  return `${JSON.stringify(sortedJson(lock), null, 2)}\n`;
}

/**
 * Adds the registry's current releases to the recorded ones. A release
 * already recorded must be unchanged; a new one must pass
 * `checkMetricChange` against the latest recorded release of its metric.
 * Releases are never removed.
 *
 * @param recorded - Releases in the existing lock file.
 * @param metrics - The registry.
 * @returns The releases to write, sorted by metric id, then in recorded order.
 * @throws Error naming every release that breaks the versioning rules.
 */
export function nextReleases(
  recorded: readonly MetricRelease[],
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): MetricRelease[] {
  const releases = [...recorded];
  const problems: string[] = [];
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(sortedJson(a)) === JSON.stringify(sortedJson(b));
  for (const metric of metrics) {
    const release = metricRelease(metric);
    const history = releases.filter((r) => r.id === metric.id);
    const existing = history.find((r) => r.version === metric.version);
    if (existing !== undefined) {
      if (!same(existing, release)) {
        problems.push(
          `${metric.id} ${metric.version} changed after it was released; give the change a new version`
        );
      }
      continue;
    }
    const latest = history.at(-1);
    if (latest !== undefined) {
      problems.push(
        ...checkMetricChange(latest, release).map((f) => f.message)
      );
    }
    releases.push(release);
  }
  if (problems.length > 0) {
    throw new Error(
      `Metric releases break the versioning rules:\n${problems.join("\n")}`
    );
  }
  return releases.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The recorded releases in a lock file on disk, or none when it does not exist. */
export function readLock(workspaceRoot: string): MetricRelease[] {
  const file = path.join(workspaceRoot, METRIC_LOCK_FILE);
  if (!fs.existsSync(file)) return [];
  return (JSON.parse(fs.readFileSync(file, "utf8")) as MetricLockFile)
    .releases as MetricRelease[];
}

/** Writes every generated file and the lock under the workspace root. */
export function writeMetricArtifacts(workspaceRoot: string): string[] {
  const lock: MetricLockFile = {
    notice: `Released metric contracts, appended by scripts/generate-metric-artifacts.ts; never edit or remove a release. ${SYNTHETIC_DATA_NOTICE}`,
    releases: nextReleases(readLock(workspaceRoot)),
  };
  const files = { ...metricArtifacts(), [METRIC_LOCK_FILE]: lockText(lock) };
  return Object.entries(files).map(([relative, contents]) => {
    const file = path.join(workspaceRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
    return relative;
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  for (const file of writeMetricArtifacts(process.cwd())) {
    console.log(`Generated ${file}`);
  }
}
