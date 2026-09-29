import {
  POPULATION_LABELS,
  type Arm,
  type PopulationSnapshot,
  type RowStatistic,
  type SapRulebook,
  type StagedTable,
  type Subject,
} from "../types";
import { matchingEvents, members } from "./validator";

/**
 * One subject-level Listing row, in CDISC style: the subject (USUBJID), its
 * arm, the visit, and the raw measurement behind the traced statistic.
 */
export interface ListingRow {
  usubjid: string;
  arm: Arm;
  visit: string;
  parameter: string;
  value: string;
}

/**
 * The patient Listing behind one summary table cell: every subject in the
 * SAP population, filtered on the snapshot that produced the table, and the
 * subjects the cell actually counts.
 */
export interface CellTrace {
  /** The population snapshot the rows were filtered on: the table's own. */
  snapshotId: string;
  /** Every subject in the SAP population on that snapshot, by USUBJID. */
  rows: ListingRow[];
  /** The subjects the cell counts, in listing order. */
  matchedSubjectIds: string[];
}

const byId = (a: Subject, b: Subject) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const eventText = (e: NonNullable<Subject["adverseEvents"]>[number]) =>
  `${e.term} (G${e.grade}${e.serious ? ", serious" : ""})`;

/** What one subject contributes to a statistic, and whether it is counted. */
function measure(
  statistic: RowStatistic,
  subject: Subject,
  populationLabel: string
): { parameter: string; value: string; counted: boolean } {
  switch (statistic.kind) {
    case "POPULATION_N":
      return {
        parameter: "Population",
        value: `${populationLabel}: Y`,
        counted: true,
      };
    case "MEAN_AGE":
      return {
        parameter: "Age (years)",
        value: `${subject.age}`,
        counted: true,
      };
    case "SEX_COUNT_PCT":
      return {
        parameter: "Sex",
        value: subject.sex,
        counted: subject.sex === statistic.sex,
      };
    case "AGE_AT_LEAST_COUNT_PCT":
      return {
        parameter: "Age (years)",
        value: `${subject.age}`,
        counted: subject.age >= statistic.minAge,
      };
    case "AE_SUBJECT_COUNT_PCT": {
      const events = matchingEvents(statistic, subject);
      return {
        parameter: "Adverse event",
        value:
          events.length > 0
            ? events.map(eventText).join("; ")
            : "None matching",
        counted: events.length > 0,
      };
    }
  }
}

/**
 * Traces one summary table cell to its patient Listing rows. Rows are
 * filtered on the snapshot the table was compiled against and on the SAP
 * population, restricted to the cell's column arm; a subject is matched
 * when the cell's statistic counts it (every subject, for an N or a mean).
 * Returns null for a cell outside the table. Pure.
 */
export function traceCell(
  table: StagedTable,
  snapshot: PopulationSnapshot,
  rulebook: SapRulebook,
  row: number,
  col: number
): CellTrace | null {
  const statistic = table.rows[row]?.statistic;
  const column = table.columns[col];
  if (!statistic || !column) return null;
  const label = POPULATION_LABELS[rulebook.populationSuit];
  const population = [
    ...members(snapshot.subjects, rulebook.populationSuit, column.arm),
  ].sort(byId);
  const rows: ListingRow[] = [];
  const matchedSubjectIds: string[] = [];
  for (const subject of population) {
    const { parameter, value, counted } = measure(statistic, subject, label);
    rows.push({
      usubjid: subject.id,
      arm: subject.arm,
      visit:
        statistic.kind === "AE_SUBJECT_COUNT_PCT" ? "On treatment" : "Baseline",
      parameter,
      value,
    });
    if (counted) matchedSubjectIds.push(subject.id);
  }
  return { snapshotId: snapshot.id, rows, matchedSubjectIds };
}
