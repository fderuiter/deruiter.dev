import {
  RoundingModeSchema,
  type ColumnArm,
  type PopulationSnapshot,
  type PopulationType,
  type RoundingMode,
  type RowStatistic,
  type SapRulebook,
  type StagedTable,
  type TableShellSpec,
} from "../types";
import { decimalPlaces, roundRatio } from "./rounding";
import {
  COUNT_PCT_PATTERN,
  NOT_ESTIMABLE,
  alternativePopulations,
  matchingEvents,
  members,
  ratioFor,
} from "./validator";

/**
 * How a program produced one cell: which population it divided by, at what
 * precision and rounding, and whether it counted events instead of subjects.
 * The SAP's own mechanism produces the correct value.
 */
interface Mechanism {
  population: PopulationType;
  precision: number;
  mode: RoundingMode;
  countEvents: boolean;
}

/** The value a mechanism prints for one cell of a snapshot. */
function render(
  statistic: RowStatistic,
  arm: ColumnArm,
  snapshot: PopulationSnapshot,
  rulebook: SapRulebook,
  m: Mechanism
): string {
  const base = members(snapshot.subjects, m.population, arm);
  if (statistic.kind === "POPULATION_N") return String(base.length);
  if (base.length === 0) return NOT_ESTIMABLE;
  if (statistic.kind === "MEAN_AGE") {
    const { numerator, denominator } = ratioFor(statistic, base);
    return roundRatio(numerator, denominator, m.precision, m.mode) as string;
  }
  // A count's numerator always comes from the SAP population; a wrong
  // population shows up in the denominator, as the validator explains it.
  const suit = members(snapshot.subjects, rulebook.populationSuit, arm);
  const count =
    m.countEvents && statistic.kind === "AE_SUBJECT_COUNT_PCT"
      ? suit.reduce((sum, s) => sum + matchingEvents(statistic, s).length, 0)
      : ratioFor(statistic, suit).numerator / 100;
  return `${count} (${roundRatio(count * 100, base.length, m.precision, m.mode)})`;
}

/** The SAP's mechanism for a row: the one that prints the correct value. */
function sapMechanism(
  statistic: RowStatistic,
  rulebook: SapRulebook
): Mechanism {
  return {
    population: rulebook.populationSuit,
    precision:
      statistic.kind === "MEAN_AGE"
        ? rulebook.meanPrecision
        : rulebook.percentPrecision,
    mode: rulebook.roundingMode,
    countEvents: false,
  };
}

/**
 * Every mechanism that could have printed `displayed`, SAP first: the SAP
 * population then every other one, the SAP precision then the shown one, the
 * SAP rounding then the others, subjects then events.
 */
function candidates(
  statistic: RowStatistic,
  rulebook: SapRulebook,
  displayed: string
): Mechanism[] {
  const sap = sapMechanism(statistic, rulebook);
  const populations = [
    rulebook.populationSuit,
    ...alternativePopulations(rulebook),
  ];
  if (statistic.kind === "POPULATION_N") {
    return populations.map((population) => ({ ...sap, population }));
  }
  const number =
    statistic.kind === "MEAN_AGE"
      ? displayed
      : (COUNT_PCT_PATTERN.exec(displayed)?.[2] ?? "");
  const precisions = [...new Set([sap.precision, decimalPlaces(number)])];
  const modes = [
    sap.mode,
    ...RoundingModeSchema.options.filter((mode) => mode !== sap.mode),
  ];
  const events =
    statistic.kind === "AE_SUBJECT_COUNT_PCT" ? [false, true] : [false];
  const result: Mechanism[] = [];
  for (const countEvents of events) {
    for (const population of populations) {
      for (const precision of precisions) {
        for (const mode of modes) {
          result.push({ population, precision, mode, countEvents });
        }
      }
    }
  }
  return result;
}

/**
 * Recompiles a draft against another population snapshot, as a programmer
 * rerunning the same program on new data.
 *
 * - A correct cell is recomputed from the new snapshot.
 * - A cell in `correctedCells` (`row:col`) is recomputed correctly too: the
 *   reviewer's fix went into the program.
 * - Any other defect is reproduced by the mechanism that explains it on the
 *   old snapshot. A precision slip stays a precision slip, and a FAS
 *   denominator stays a FAS denominator, on the new data.
 * - A value no mechanism explains is reproduced as typed.
 *
 * Pure: returns a new table and never modifies its inputs.
 */
export function compileDraft(
  draft: StagedTable,
  from: PopulationSnapshot,
  to: PopulationSnapshot,
  rulebook: SapRulebook,
  correctedCells: ReadonlySet<string> = new Set()
): StagedTable {
  const cells = draft.rows.map((row, r) =>
    draft.columns.map((column, c) => {
      const displayed = (draft.cells[r][c] ?? "").trim();
      const mechanism = correctedCells.has(`${r}:${c}`)
        ? sapMechanism(row.statistic, rulebook)
        : candidates(row.statistic, rulebook, displayed).find(
            (m) =>
              render(row.statistic, column.arm, from, rulebook, m) === displayed
          );
      return mechanism
        ? render(row.statistic, column.arm, to, rulebook, mechanism)
        : displayed;
    })
  );
  return { ...draft, populationSnapshotId: to.id, cells };
}

/**
 * Compiles a blank shell against a snapshot, as the programmer running it on
 * the analysis set the player allocated. `rulebook` names that set as its
 * population suit, so every cell is printed exactly as the SAP requires.
 * Pure: the shell and snapshot are never modified.
 */
export function compileShell(
  shell: TableShellSpec & { layout: NonNullable<TableShellSpec["layout"]> },
  id: string,
  snapshot: PopulationSnapshot,
  rulebook: SapRulebook
): StagedTable {
  const { columns, rows } = shell.layout;
  return {
    id,
    shellId: shell.id,
    draftLabel: `Compiled on ${snapshot.id}`,
    populationSnapshotId: snapshot.id,
    columns,
    rows,
    cells: rows.map((row) =>
      columns.map((column) =>
        render(
          row.statistic,
          column.arm,
          snapshot,
          rulebook,
          sapMechanism(row.statistic, rulebook)
        )
      )
    ),
  };
}
