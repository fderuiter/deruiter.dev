/**
 * Governance checks of the metric registry: that every definition is
 * computable from the gold model and safe to compile, that versions follow
 * semantic versioning (a changed certified metric needs a major bump), and
 * that a certified report uses certified metrics only.
 */
import { CANONICAL_GLOSSARY } from "@/lib/term-glossary";
import type {
  MetricContract,
  MetricDefinition,
  MetricExpression,
  MetricFinding,
  MetricMeasure,
  MetricPredicate,
  MetricRelease,
  MetricReport,
  WarehouseColumn,
} from "../../types";
import { checkRegulatoryWording, findClinicalClaims } from "../policy";
import {
  METRIC_DIMENSIONS,
  resolveDimension,
  warehouseTable,
} from "./dimensions";
import { formulaSources, isIsoDate } from "./plan";
import { METRIC_REGISTRY } from "./registry";

type ValueType = "number" | "text" | "boolean" | "date";

const GLOSSARY_KEYS = new Set(CANONICAL_GLOSSARY.map((t) => t.key));
const DIMENSION_IDS = new Set(METRIC_DIMENSIONS.map((d) => d.id));
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Major, minor and patch of a semantic version, or `null` when it is not one. */
function semver(version: string): [number, number, number] | null {
  const match = SEMVER.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** JSON with object keys sorted, so equal values give equal text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function columnType(column: WarehouseColumn): ValueType | null {
  switch (column.type) {
    case "integer":
    case "decimal":
      return "number";
    case "string":
      return "text";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "timestamp":
      return null;
  }
}

/** Checks one measure against the warehouse schema and the compile rules. */
function checkMeasure(
  measure: MetricMeasure,
  allowsMonth: boolean,
  report: (message: string) => void
): void {
  const table = warehouseTable(measure.table);
  if (table === undefined || table.layer !== "gold") {
    report(`reads ${measure.table}, which is not a gold table`);
    return;
  }
  const columns = new Map(table.columns.map((c) => [c.name, c]));
  const referenced = new Set<string>();
  const find = (name: string): WarehouseColumn | null => {
    const found = columns.get(name);
    if (found === undefined) report(`${measure.table} has no column ${name}`);
    return found ?? null;
  };
  const isDateKey = (c: WarehouseColumn) =>
    c.type === "integer" && c.references?.table === "gold.dim_date";

  const typeOf = (e: MetricExpression): ValueType | null => {
    switch (e.kind) {
      case "column": {
        referenced.add(e.column);
        const c = find(e.column);
        if (c === null) return null;
        const type = columnType(c);
        if (type === null) report(`${e.column} is a timestamp; use a date key`);
        return type;
      }
      case "literal":
        return typeof e.value === "string"
          ? "text"
          : typeof e.value === "number"
            ? "number"
            : "boolean";
      case "date-of-key": {
        referenced.add(e.column);
        const c = find(e.column);
        if (c !== null && !isDateKey(c)) {
          report(`${e.column} is not a date key to gold.dim_date`);
        }
        return "date";
      }
      case "data-cut":
        return "date";
      case "days-between": {
        const from = typeOf(e.from);
        const to = typeOf(e.to);
        if (from !== "date" || to !== "date") {
          report("days-between needs two dates");
        }
        return "number";
      }
    }
  };

  const checkPredicate = (p: MetricPredicate) => {
    switch (p.kind) {
      case "null":
        find(p.column);
        return;
      case "in": {
        referenced.add(p.column);
        const c = find(p.column);
        if (c !== null && c.type !== "string") {
          report(`an in-list needs a text column, not ${p.column}`);
        }
        if (p.values.length === 0)
          report(`the in-list on ${p.column} is empty`);
        return;
      }
      case "compare": {
        const left = typeOf(p.left);
        const right = typeOf(p.right);
        if (left !== null && right !== null && left !== right) {
          report(`compares ${left} with ${right}`);
        }
        if (left === "boolean" && p.operator !== "=" && p.operator !== "<>") {
          report(`orders booleans with ${p.operator}`);
        }
      }
    }
  };

  measure.where.forEach(checkPredicate);
  if (measure.aggregation === "count") {
    if (measure.expression !== null) report("a count takes no expression");
  } else if (measure.expression === null) {
    report(`${measure.aggregation} needs an expression`);
  } else if (measure.aggregation === "count-distinct") {
    if (measure.expression.kind !== "column") {
      report("count-distinct needs a column");
    }
    typeOf(measure.expression);
  } else if (typeOf(measure.expression) !== "number") {
    report(`${measure.aggregation} needs a number`);
  }
  if (measure.timeKey !== null) {
    const c = find(measure.timeKey);
    if (c !== null && !isDateKey(c)) {
      report(`time key ${measure.timeKey} is not a date key to gold.dim_date`);
    }
    if (allowsMonth) referenced.add(measure.timeKey);
  }
  // A null operand behaves differently in SQL and DAX, so every nullable
  // column a measure reads must be guarded explicitly.
  for (const name of referenced) {
    const c = columns.get(name);
    if (
      c?.nullable &&
      !measure.where.some(
        (p) => p.kind === "null" && p.column === name && !p.isNull
      )
    ) {
      report(`reads nullable ${name} without a not-null condition`);
    }
  }
}

/** Checks one definition; see `checkMetricRegistry`. */
function checkDefinition(metric: MetricDefinition): MetricFinding[] {
  const findings: MetricFinding[] = [];
  const report = (message: string) =>
    findings.push({ rule: "definition", metricId: metric.id, message });

  if (!/^[a-z][a-z0-9_]*$/.test(metric.id)) report("the id is not snake case");
  for (const [field, value] of Object.entries({
    name: metric.name,
    description: metric.description,
    unit: metric.unit,
    owner: metric.owner,
    steward: metric.steward,
    displayFolder: metric.displayFolder,
  })) {
    if (value.trim() === "") report(`${field} is empty`);
  }
  for (const text of [metric.name, metric.description]) {
    for (const finding of [
      ...checkRegulatoryWording(text),
      ...findClinicalClaims(text),
    ]) {
      report(finding.message);
    }
  }
  if (metric.glossaryTerm !== null && !GLOSSARY_KEYS.has(metric.glossaryTerm)) {
    report(`glossary term ${metric.glossaryTerm} is not in CANONICAL_GLOSSARY`);
  }
  if (
    !Number.isInteger(metric.format.decimals) ||
    metric.format.decimals < 0 ||
    metric.format.decimals > 4
  ) {
    report("format decimals must be a whole number from 0 to 4");
  }

  const version = semver(metric.version);
  if (version === null) report(`version ${metric.version} is not x.y.z`);
  let previous: [number, number, number] | null = null;
  for (const entry of metric.changeLog) {
    const v = semver(entry.version);
    if (v === null) report(`change log version ${entry.version} is not x.y.z`);
    if (!isIsoDate(entry.date))
      report(`change log date ${entry.date} is not a date`);
    if (entry.summary.trim() === "")
      report("a change log entry has no summary");
    if (v !== null && previous !== null && compareVersions(v, previous) <= 0) {
      report("change log versions do not increase");
    }
    if (v !== null) previous = v;
  }
  if (metric.changeLog.at(-1)?.version !== metric.version) {
    report(`the change log does not end at version ${metric.version}`);
  }

  const formula = metric.formula;
  const dimensions = metric.allowedDimensions;
  if (new Set(dimensions).size !== dimensions.length) {
    report("an allowed dimension is listed twice");
  }
  if (formula.kind === "milestone-span" && metric.grain !== "study") {
    report("a milestone span is defined per study; its grain must be study");
  }
  if (metric.grain === "study" && !dimensions.includes("study")) {
    report("a study grain metric must allow the study dimension");
  }
  if (
    formula.kind === "ratio" &&
    !(formula.scale > 0 && Number.isFinite(formula.scale))
  ) {
    report("a ratio's scale must be a positive number");
  }
  if (formula.kind === "milestone-span" && formula.from === formula.to) {
    report("a milestone span needs two different milestones");
  }
  const sources = formulaSources(formula);
  for (const source of sources) {
    if (source.measure !== null) {
      checkMeasure(source.measure, dimensions.includes("month"), (m) =>
        report(`${source.role}: ${m}`)
      );
    }
  }
  for (const id of dimensions) {
    if (!DIMENSION_IDS.has(id)) {
      report(`unknown dimension ${String(id)}`);
      continue;
    }
    for (const source of sources) {
      const path = resolveDimension(source.table, source.timeKey, id);
      if (
        path === null ||
        (source.role === "span" && path.join?.from !== "study_key")
      ) {
        report(`${source.role} on ${source.table} cannot reach ${id}`);
      }
    }
  }
  const filtered = metric.defaultFilters.map((f) => f.dimension);
  if (new Set(filtered).size !== filtered.length) {
    report("two default filters share a dimension");
  }
  for (const filter of metric.defaultFilters) {
    if (!dimensions.includes(filter.dimension)) {
      report(`default filter on ${filter.dimension}, which is not allowed`);
    }
    if (filter.values.length === 0) {
      report(`default filter on ${filter.dimension} lists no values`);
    }
  }
  return findings;
}

/**
 * Checks metric definitions against the gold model and the registry's rules.
 * A definition must read gold tables and columns that exist, with types its
 * aggregation accepts; guard every nullable column it reads with a not-null
 * condition (a `null` operand differs between SQL and DAX); reach every
 * allowed dimension from every table it reads; keep a semantic version that
 * its change log ends at; link an existing glossary term; and make no
 * compliance or validation claim. Ids and names must be unique.
 *
 * @param metrics - Definitions to check; defaults to `METRIC_REGISTRY`.
 * @returns Every broken rule; empty when the registry is sound.
 */
export function checkMetricRegistry(
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): MetricFinding[] {
  const findings = metrics.flatMap(checkDefinition);
  for (const key of ["id", "name"] as const) {
    const seen = new Set<string>();
    for (const metric of metrics) {
      if (seen.has(metric[key])) {
        findings.push({
          rule: "definition",
          metricId: metric.id,
          message: `${key} ${metric[key]} is used twice`,
        });
      }
      seen.add(metric[key]);
    }
  }
  return findings;
}

/**
 * The release record of a metric: its id, version, status and contract, the
 * part of the definition that decides its values.
 *
 * @param metric - Metric definition.
 * @returns The release, as the registry lock file records it.
 */
export function metricRelease(metric: MetricDefinition): MetricRelease {
  const contract: MetricContract = {
    formula: metric.formula,
    grain: metric.grain,
    unit: metric.unit,
    defaultFilters: metric.defaultFilters,
    allowedDimensions: metric.allowedDimensions,
  };
  return {
    id: metric.id,
    version: metric.version,
    status: metric.status,
    contract,
  };
}

/**
 * Checks one release of a metric against the release before it. A change to
 * the formula, grain, unit or default filters, or a removed dimension, is
 * breaking: a certified metric then needs a major version bump. An added
 * dimension or a status change needs at least a minor bump. A version may
 * not go backwards, the same version may not describe two contracts, and a
 * deprecated metric does not return to use.
 *
 * @param previous - The earlier release.
 * @param next - The release that follows it.
 * @returns Every broken versioning rule; empty when the change is versioned correctly.
 */
export function checkMetricChange(
  previous: MetricRelease,
  next: MetricRelease
): MetricFinding[] {
  const findings: MetricFinding[] = [];
  const report = (message: string) =>
    findings.push({ rule: "version", metricId: next.id, message });
  if (previous.id !== next.id) {
    report(`compares ${next.id} with a release of ${previous.id}`);
    return findings;
  }
  const from = semver(previous.version);
  const to = semver(next.version);
  if (from === null || to === null) {
    report(`${from === null ? previous.version : next.version} is not x.y.z`);
    return findings;
  }
  const order = compareVersions(to, from);
  const a = previous.contract;
  const b = next.contract;
  const removed = a.allowedDimensions.filter(
    (d) => !b.allowedDimensions.includes(d)
  );
  const added = b.allowedDimensions.filter(
    (d) => !a.allowedDimensions.includes(d)
  );
  const breaking =
    canonical([a.formula, a.grain, a.unit, a.defaultFilters]) !==
      canonical([b.formula, b.grain, b.unit, b.defaultFilters]) ||
    removed.length > 0;
  const statusChanged = previous.status !== next.status;
  if (order < 0) {
    report(`version ${next.version} is lower than ${previous.version}`);
    return findings;
  }
  if (order === 0) {
    if (breaking || added.length > 0 || statusChanged) {
      report(`version ${next.version} changed without a new version number`);
    }
    return findings;
  }
  if (previous.status === "deprecated" && next.status !== "deprecated") {
    report("a deprecated metric does not return to use; define a new metric");
  }
  if (breaking && previous.status === "certified" && to[0] <= from[0]) {
    report(
      `changes what certified ${next.id} computes without a major version bump (${previous.version} to ${next.version})`
    );
  }
  if (
    (added.length > 0 || statusChanged) &&
    to[0] === from[0] &&
    to[1] <= from[1]
  ) {
    report(
      `${statusChanged ? "a status change" : "an added dimension"} needs at least a minor version bump`
    );
  }
  return findings;
}

/**
 * Checks the metrics a report uses. Every id must name a registry metric,
 * and a certified report may only use certified metrics: never a draft and
 * never a deprecated one.
 *
 * @param report - The report and the metric ids it shows.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns One finding per broken rule; empty when the report may publish.
 */
export function checkReportMetrics(
  report: MetricReport,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): MetricFinding[] {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  return report.metricIds.flatMap((id): MetricFinding[] => {
    const metric = byId.get(id);
    if (metric === undefined) {
      return [
        {
          rule: "report",
          metricId: id,
          message: `${report.id} uses ${id}, which is not in the registry`,
        },
      ];
    }
    if (report.certified && metric.status !== "certified") {
      return [
        {
          rule: "report",
          metricId: id,
          message: `certified report ${report.id} cannot use ${metric.status} metric ${id}`,
        },
      ];
    }
    return [];
  });
}
