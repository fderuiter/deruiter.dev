/**
 * What an exploration hands on (#2634): its result as CSV, and the steps a
 * person would take to promote it from an exploratory report to a managed
 * or certified one.
 */
import type {
  MetricDefinition,
  PromotionStep,
  ReportData,
  ReportSpec,
} from "../../types";
import { csvText } from "../csv";
import { checkReportSpec } from "../reporting/check";
import { METRIC_REGISTRY } from "../semantic/registry";
import {
  EXPLORATION_AUDIENCE,
  EXPLORATION_OWNER,
  EXPLORATION_PURPOSE,
} from "./model";

/**
 * A built report as CSV: one column per grouped dimension, then one per
 * metric headed with its name and unit, and one row per group. Values are
 * unformatted numbers with full precision, so a spreadsheet can compute
 * with them; a value the metric does not define is empty. Lines end with
 * CRLF, as RFC 4180 asks.
 *
 * @param report - A report from `runExploration` or `buildReport`.
 * @returns The CSV text.
 */
export function explorationCsv(report: ReportData): string {
  const header = [
    ...report.dimensionLabels,
    ...report.columns.map((column) => `${column.name} (${column.unit})`),
  ].map(csvText);
  const rows = report.rows.map((row) => [
    ...row.labels.map(csvText),
    ...row.cells.map((cell) => (cell.value === null ? "" : String(cell.value))),
  ]);
  return `${[header, ...rows].map((fields) => fields.join(",")).join("\r\n")}\r\n`;
}

/**
 * The steps that promote an exploratory report to a managed report, owned
 * and maintained by a team, and then to a certified one. A step is `met`
 * when the spec already satisfies it, and `to-do` when a person has to act.
 * The explorer shows the list; it never promotes anything itself.
 *
 * @param spec - An exploratory report spec, usually from `runExploration`.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The steps, managed first, then certified.
 */
export function promotionSteps(
  spec: ReportSpec,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): PromotionStep[] {
  const findings = checkReportSpec(spec, metrics).filter(
    (finding) => finding.rule !== "tier"
  );
  const shown = spec.metrics.map((id) => metrics.find((m) => m.id === id));
  const uncertified = shown.filter(
    (metric) => metric !== undefined && metric.status !== "certified"
  );
  const released = !spec.version.startsWith("0.");
  const step = (
    id: string,
    tier: PromotionStep["tier"],
    label: string,
    met: boolean,
    done: string,
    todo: string
  ): PromotionStep => ({
    id,
    tier,
    label,
    detail: met ? done : todo,
    status: met ? "met" : "to-do",
  });
  return [
    step(
      "rules",
      "managed",
      "Pass the reporting rules.",
      findings.length === 0,
      "The spec passes every rule checkReportSpec applies to its fields, metrics and visual.",
      `Fix what the rules find: ${findings.map((f) => f.message).join("; ")}.`
    ),
    step(
      "owner",
      "managed",
      "Name the team that owns and maintains it.",
      spec.owner !== EXPLORATION_OWNER,
      `Owned by ${spec.owner}.`,
      "No team owns it yet. A managed report names the role that answers for it."
    ),
    step(
      "audience",
      "managed",
      "Say who reads it and what decision it supports.",
      spec.audience !== EXPLORATION_AUDIENCE &&
        spec.purpose !== EXPLORATION_PURPOSE,
      `For ${spec.audience}: ${spec.purpose}`,
      "The owner writes the audience and the decision it supports, in place of the explorer's placeholder."
    ),
    step(
      "release",
      "managed",
      "Release it at version 1.0.0 or later, with a refresh SLA its readers agreed.",
      released,
      `Released at version ${spec.version}, refreshed within ${spec.refreshSlaHours} hours.`,
      `It is at ${spec.version}, a draft, with the explorer's default refresh SLA of ${spec.refreshSlaHours} hours. The owner agrees the SLA, releases 1.0.0 and adds the spec to the report pack, where the catalog lists it.`
    ),
    step(
      "certified-metrics",
      "certified",
      "Use only certified metrics.",
      shown.every((metric) => metric !== undefined) && uncertified.length === 0,
      "Every metric it shows is certified.",
      `These metrics are not certified: ${uncertified
        .map((metric) => metric?.name)
        .join(", ")}.`
    ),
    step(
      "sign-off",
      "certified",
      "Carry the owner's sign-off on its current version.",
      spec.signOff !== null && spec.signOff.version === spec.version,
      `Signed off by ${spec.signOff?.role} on ${spec.signOff?.date}.`,
      "The owner signs off on the released version. A new version needs a new sign-off."
    ),
  ];
}
