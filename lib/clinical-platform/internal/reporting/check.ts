/**
 * Governance rules for report specs (#2625): what a spec must say, which
 * metrics its tier may use, and which visuals fit its grouping. A spec
 * that breaks a rule cannot be built.
 */
import type {
  MetricDefinition,
  ReportFinding,
  ReportSpec,
  ReportVisual,
} from "../../types";
import { checkReportMetrics, semver } from "../semantic/check";
import { isIsoDate, planMetric } from "../semantic/plan";
import { METRIC_REGISTRY } from "../semantic/registry";

const REPORT_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * A valid data cut for planning a metric without a warehouse. Planning only
 * checks that a cut is present for metrics that measure age at the cut; the
 * date itself does not change whether a grouping is allowed.
 */
const PLANNING_DATA_CUT = "2000-01-01";

/** Grouping each visual draws, as a rule and its wording. */
const VISUAL_GROUPING: Readonly<
  Record<
    ReportVisual,
    {
      readonly fits: (dimensions: readonly string[]) => boolean;
      readonly needs: string;
    }
  >
> = {
  bar: {
    fits: (dimensions) => dimensions.length === 1,
    needs: "exactly one dimension",
  },
  line: {
    fits: (dimensions) => dimensions.length === 1 && dimensions[0] === "month",
    needs: "the month dimension alone",
  },
  stat: {
    fits: (dimensions) => dimensions.length === 0,
    needs: "no dimensions",
  },
  table: {
    fits: (dimensions) => dimensions.length <= 2,
    needs: "at most two dimensions",
  },
};

/**
 * Whether a visual can draw a grouping, by the rule `checkReportSpec`
 * applies; the explorer offers only the visuals that pass it.
 *
 * @param visual - The visual.
 * @param dimensions - The dimensions grouped by.
 * @returns `true` when the visual fits.
 */
export function visualFitsGrouping(
  visual: ReportVisual,
  dimensions: readonly string[]
): boolean {
  return VISUAL_GROUPING[visual].fits(dimensions);
}

function specFindings(spec: ReportSpec): string[] {
  const messages: string[] = [];
  if (!REPORT_ID.test(spec.id)) {
    messages.push(`id ${JSON.stringify(spec.id)} is not in kebab case`);
  }
  for (const field of ["title", "audience", "purpose", "owner"] as const) {
    if (spec[field].trim() === "") messages.push(`${field} is empty`);
  }
  if (semver(spec.version) === null) {
    messages.push(`version ${spec.version} is not a semantic version`);
  }
  if (!Number.isInteger(spec.refreshSlaHours) || spec.refreshSlaHours < 1) {
    messages.push(
      "the refresh SLA must be a whole number of hours, at least 1"
    );
  }
  if (spec.metrics.length === 0) messages.push("it shows no metrics");
  if (new Set(spec.metrics).size !== spec.metrics.length) {
    messages.push("it lists a metric twice");
  }
  if (new Set(spec.dimensions).size !== spec.dimensions.length) {
    messages.push("it groups by a dimension twice");
  }
  return messages;
}

function tierFindings(spec: ReportSpec): string[] {
  if (spec.tier !== "certified") return [];
  const signOff = spec.signOff;
  if (signOff === null)
    return ["a certified report needs the owner's sign-off"];
  const messages: string[] = [];
  if (signOff.role.trim() === "") messages.push("the sign-off names no role");
  if (!isIsoDate(signOff.date)) {
    messages.push(`sign-off date ${signOff.date} is not an ISO 8601 date`);
  }
  if (signOff.version !== spec.version) {
    messages.push(
      `the sign-off is for version ${signOff.version}, not ${spec.version}`
    );
  }
  return messages;
}

function metricFindings(
  spec: ReportSpec,
  metrics: readonly MetricDefinition[]
): string[] {
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  // Certified reports use only certified metrics: the registry's own rule.
  const messages = checkReportMetrics(
    {
      id: spec.id,
      title: spec.title,
      certified: spec.tier === "certified",
      metricIds: spec.metrics,
    },
    metrics
  ).map((finding) => finding.message);
  for (const id of spec.metrics) {
    const metric = byId.get(id);
    if (metric === undefined) continue;
    if (metric.status === "deprecated" && spec.tier !== "certified") {
      messages.push(`${spec.id} cannot use deprecated metric ${id}`);
    }
    try {
      planMetric(
        metric,
        { dimensions: spec.dimensions, filters: spec.filters },
        PLANNING_DATA_CUT
      );
    } catch (error) {
      messages.push((error as Error).message);
    }
  }
  return messages;
}

function visualFindings(
  spec: ReportSpec,
  metrics: readonly MetricDefinition[]
): string[] {
  const messages: string[] = [];
  const grouping = VISUAL_GROUPING[spec.visual];
  if (!grouping.fits(spec.dimensions)) {
    messages.push(`a ${spec.visual} report groups by ${grouping.needs}`);
  }
  if (spec.visual === "table") return messages;
  // A chart has one value axis, so its metrics share a unit and a format.
  const shown = spec.metrics.flatMap((id) => {
    const metric = metrics.find((candidate) => candidate.id === id);
    return metric ? [metric] : [];
  });
  const scales = new Set(
    shown.map((metric) => `${metric.unit}|${metric.format.style}`)
  );
  if (scales.size > 1) {
    messages.push(
      `a ${spec.visual} report shares one value axis, but its metrics are in ${[
        ...new Set(shown.map((metric) => metric.unit)),
      ].join(", ")}; use a table or one report per unit`
    );
  }
  return messages;
}

/**
 * Checks a report spec against the reporting rules:
 *
 * - its id, text fields, version and refresh SLA are well formed, and it
 *   lists each metric and dimension once;
 * - every metric is in the registry and may be grouped and filtered the way
 *   the spec asks; a certified report uses only certified metrics, and no
 *   report uses a deprecated one;
 * - its visual fits its grouping, and a chart's metrics share one unit;
 * - a certified report carries an owner's sign-off on its current version.
 *
 * @param spec - The spec.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns One finding per broken rule; empty when the report may be built.
 */
export function checkReportSpec(
  spec: ReportSpec,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): ReportFinding[] {
  const findings = (rule: ReportFinding["rule"], messages: string[]) =>
    messages.map((message) => ({ reportId: spec.id, rule, message }));
  return [
    ...findings("spec", specFindings(spec)),
    ...findings("metric", metricFindings(spec, metrics)),
    ...findings("visual", visualFindings(spec, metrics)),
    ...findings("tier", tierFindings(spec)),
  ];
}
