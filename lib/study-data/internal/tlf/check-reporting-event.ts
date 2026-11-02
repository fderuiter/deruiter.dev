/**
 * Checks that every result of an ARS reporting event traces to ADaM rows
 * and, given the study, that the rows and values reproduce.
 *
 * `buildTlfOutputs` writes the event, so a finding here means the event was
 * changed after it was built, or the run it is checked against is not the
 * run it was built from. The check only reads; it never changes the event.
 */
import type {
  ArsOperationResult,
  ArsReportingEvent,
  Finding,
  PipelineRun,
  ResultRow,
  StudyDefinition,
} from "../../types";
import { evaluateAnalyses } from "./evaluate";
import { buildReportingPlan, unplannedTreatments } from "./plan";
import { indexAdamRows, resolveResultRows } from "./row-ids";

const ARS_CITATION =
  "CDISC Analysis Results Standard 1.0, result-to-data traceability: https://www.cdisc.org/standards/foundational/analysis-results-standard";

/** Rule ids {@link checkReportingEvent} reports, one per kind of gap. */
export const REPORTING_EVENT_RULES = Object.freeze({
  rowIdDuplicate: "ARS-ROW-ID-DUPLICATE",
  rowSetUnresolved: "ARS-ROWSET-UNRESOLVED",
  rowSetEmpty: "ARS-ROWSET-EMPTY",
  resultMissing: "ARS-RESULT-MISSING",
  resultNotReproduced: "ARS-RESULT-NOT-REPRODUCED",
} as const);

/**
 * True for a count of zero: a result that may have no rows behind it
 * because there were none to count.
 */
function isZeroCount(result: ArsOperationResult): boolean {
  return result.rawValue !== undefined && Number(result.rawValue) === 0;
}

function rowKey(rows: readonly { role: string; rowId: string }[]): string {
  return rows
    .map((row) => `${row.role} ${row.rowId}`)
    .sort()
    .join("\n");
}

/**
 * Checks an ARS reporting event against the run it reports on.
 *
 * Every ADaM row must have its own id, every result's row-set references
 * must resolve to rows of the run's ADaM datasets, and a result must have rows behind it unless it is a count of
 * zero. With the study definition, the analyses are also evaluated again
 * from the ADaM datasets, and every result must come back with the same
 * value and the same rows, and no result may be missing from the event.
 *
 * @param event - The reporting event, as `buildTlfOutputs` returns it.
 * @param run - The run the event reports on.
 * @param definition - The study the run was made from; without it the
 *   results are not evaluated again.
 * @returns One error finding per gap, in result order; none when every
 *   result resolves (and, with the definition, reproduces).
 */
export function checkReportingEvent(
  event: ArsReportingEvent,
  run: PipelineRun,
  definition?: StudyDefinition
): Finding[] {
  const findings: Finding[] = [];
  const report = (ruleId: string, dataset: string, message: string): number =>
    findings.push({
      ruleId,
      severity: "error",
      layer: "adam",
      dataset,
      message,
      citation: ARS_CITATION,
    });

  let rows: ReturnType<typeof indexAdamRows>;
  try {
    rows = indexAdamRows(run.datasets);
  } catch (error) {
    // Results cannot name a row two rows share, so nothing else is checked.
    report(
      REPORTING_EVENT_RULES.rowIdDuplicate,
      (error as Error).message.match(/id (\w+):/)?.[1] ?? "ADSL",
      `Results cannot be traced to their rows: ${(error as Error).message}`
    );
    return findings;
  }
  const evaluation = definition
    ? evaluateAnalyses(
        run.datasets,
        buildReportingPlan(
          definition,
          unplannedTreatments(definition, run.datasets)
        )
      )
    : undefined;
  const reproduced = new Map(
    (evaluation?.analyses ?? []).flatMap((analysis) =>
      analysis.results.map((result) => [result.id, result] as const)
    )
  );
  // The evaluated results name the evaluated row sets, so they resolve
  // against an event that holds those sets.
  const reproducedEvent: ArsReportingEvent | undefined = evaluation && {
    ...event,
    rowSets: evaluation.rowSets,
  };

  const seen = new Set<string>();
  for (const analysis of event.analyses) {
    for (const result of analysis.results) {
      seen.add(result.id);
      let resolved: readonly ResultRow[];
      try {
        resolved = resolveResultRows(event, rows, result);
      } catch (error) {
        report(
          REPORTING_EVENT_RULES.rowSetUnresolved,
          analysis.dataset,
          `Result ${result.id} does not resolve: ${(error as Error).message}`
        );
        continue;
      }
      if (resolved.length === 0 && !isZeroCount(result)) {
        report(
          REPORTING_EVENT_RULES.rowSetEmpty,
          analysis.dataset,
          `Result ${result.id} (${result.formattedValue}) has no ADaM rows behind it and is not a count of zero.`
        );
      }
      if (!reproducedEvent) continue;
      const again = reproduced.get(result.id);
      if (!again) {
        report(
          REPORTING_EVENT_RULES.resultNotReproduced,
          analysis.dataset,
          `Result ${result.id} is not produced when the analyses are evaluated again.`
        );
        continue;
      }
      const differences = [
        ...(again.rawValue !== result.rawValue ||
        again.formattedValue !== result.formattedValue
          ? [
              `its value is ${result.formattedValue} but evaluates to ${again.formattedValue}`,
            ]
          : []),
        ...(rowKey(resolved) !==
        rowKey(resolveResultRows(reproducedEvent, rows, again))
          ? ["its rows differ from the rows it evaluates from"]
          : []),
      ];
      if (differences.length > 0) {
        report(
          REPORTING_EVENT_RULES.resultNotReproduced,
          analysis.dataset,
          `Result ${result.id} does not reproduce: ${differences.join(", and ")}.`
        );
      }
    }
  }
  for (const analysis of evaluation?.analyses ?? []) {
    for (const result of analysis.results) {
      if (!seen.has(result.id)) {
        report(
          REPORTING_EVENT_RULES.resultMissing,
          analysis.dataset,
          `Result ${result.id} is produced by the analyses but missing from the reporting event.`
        );
      }
    }
  }
  return findings;
}
