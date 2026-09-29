import {
  POPULATION_LABELS,
  PopulationTypeSchema,
  RoundingModeSchema,
  type CellCoordinates,
  type ColumnArm,
  type PopulationSnapshot,
  type PopulationType,
  type QcCategory,
  type QcFinding,
  type QcReport,
  type RowStatistic,
  type SapRule,
  type SapRulebook,
  type StagedTable,
  type Subject,
} from "../types";
import { decimalPlaces, roundRatio } from "./rounding";

/** Shown where a column has no subjects in the SAP population. */
export const NOT_ESTIMABLE = "—";
const INTEGER_PATTERN = /^\d+$/;
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
export const COUNT_PCT_PATTERN = /^(\d+) \((-?\d+(?:\.\d+)?)\)$/;

const CATEGORY_ORDER: Readonly<Record<QcCategory, number>> = {
  DENOMINATOR: 0,
  VALUE: 1,
  PRECISION: 2,
  ROUNDING: 3,
};

const MODE_LABELS = {
  HALF_EVEN: "half-to-even",
  HALF_AWAY_FROM_ZERO: "half-away-from-zero",
  TRUNCATE: "truncation",
} as const;

interface CellContext {
  snapshot: PopulationSnapshot;
  rulebook: SapRulebook;
  cell: CellCoordinates;
  arm: ColumnArm;
  columnLabel: string;
  observed: string;
}

/** Subjects belonging to `population`, restricted to a column's arm. */
export function members(
  subjects: readonly Subject[],
  population: PopulationType,
  arm: ColumnArm
): Subject[] {
  return subjects.filter(
    (subject) =>
      subject.populations.includes(population) &&
      (arm === "TOTAL" || subject.arm === arm)
  );
}

/**
 * Populations that could plausibly have been used by mistake: every
 * population except the suit itself and any the SAP declares equal to it.
 */
export function alternativePopulations(
  rulebook: SapRulebook
): PopulationType[] {
  const suit = rulebook.populationSuit;
  const equivalent = new Set<PopulationType>([suit]);
  for (const alias of rulebook.populationAliases) {
    if (alias.equals === suit) equivalent.add(alias.population);
    if (alias.population === suit) equivalent.add(alias.equals);
  }
  return PopulationTypeSchema.options.filter((p) => !equivalent.has(p));
}

function ruleFor(rulebook: SapRulebook, category: QcCategory): SapRule {
  // The rulebook schema guarantees one rule per category.
  return rulebook.rules.find((rule) => rule.category === category) as SapRule;
}

function finding(
  ctx: CellContext,
  category: QcCategory,
  expected: string,
  evidence: string
): QcFinding {
  const rule = ruleFor(ctx.rulebook, category);
  return {
    id: `${rule.id}@r${ctx.cell.row}c${ctx.cell.col}`,
    ruleId: rule.id,
    category,
    severity: rule.severity,
    cell: { ...ctx.cell },
    observed: ctx.observed,
    expected,
    evidence,
    rule: rule.statement,
    consequence: rule.consequence,
  };
}

/** Numerator and denominator of a row statistic for a set of subjects. */
export function ratioFor(
  statistic: RowStatistic,
  subjects: readonly Subject[]
): { numerator: number; denominator: number } {
  switch (statistic.kind) {
    case "MEAN_AGE":
      return {
        numerator: subjects.reduce((sum, s) => sum + s.age, 0),
        denominator: subjects.length,
      };
    case "SEX_COUNT_PCT":
      return {
        numerator: subjects.filter((s) => s.sex === statistic.sex).length * 100,
        denominator: subjects.length,
      };
    case "AGE_AT_LEAST_COUNT_PCT":
      return {
        numerator:
          subjects.filter((s) => s.age >= statistic.minAge).length * 100,
        denominator: subjects.length,
      };
    case "AE_SUBJECT_COUNT_PCT":
      return {
        numerator:
          subjects.filter((s) => matchingEvents(statistic, s).length > 0)
            .length * 100,
        denominator: subjects.length,
      };
    case "POPULATION_N":
      return { numerator: subjects.length, denominator: 1 };
  }
}

export type AeStatistic = Extract<
  RowStatistic,
  { kind: "AE_SUBJECT_COUNT_PCT" }
>;

/** A subject's adverse events that match every filter on the row. */
export function matchingEvents(statistic: AeStatistic, subject: Subject) {
  return (subject.adverseEvents ?? []).filter(
    (event) =>
      (statistic.soc === undefined || event.soc === statistic.soc) &&
      (statistic.term === undefined || event.term === statistic.term) &&
      (statistic.serious === undefined || event.serious) &&
      (statistic.minGrade === undefined || event.grade >= statistic.minGrade) &&
      (statistic.ledToDiscontinuation === undefined ||
        event.ledToDiscontinuation)
  );
}

/**
 * Explains a displayed statistic that has the SAP's precision but the wrong
 * value: a different rounding convention, a different population's
 * denominator, or an unexplained mismatch, in that order of preference.
 */
function classifyStatistic(
  ctx: CellContext,
  statistic: RowStatistic,
  displayed: string,
  precision: number,
  expected: string,
  numeratorLabel: string
): QcFinding {
  const { rulebook, snapshot, arm, columnLabel } = ctx;
  const suitSubjects = members(snapshot.subjects, rulebook.populationSuit, arm);
  const { numerator, denominator } = ratioFor(statistic, suitSubjects);
  const exact = `${numeratorLabel} / ${denominator}`;

  for (const mode of RoundingModeSchema.options) {
    if (mode === rulebook.roundingMode) continue;
    if (roundRatio(numerator, denominator, precision, mode) === displayed) {
      return finding(
        ctx,
        "ROUNDING",
        expected,
        `${exact} rounds to ${expected} under ${MODE_LABELS[rulebook.roundingMode]}, which the SAP requires; ${displayed} is ${MODE_LABELS[mode]}.`
      );
    }
  }

  for (const population of alternativePopulations(rulebook)) {
    const altSubjects = members(snapshot.subjects, population, arm);
    if (altSubjects.length === suitSubjects.length) continue;
    const alt = ratioFor(statistic, altSubjects);
    const altNumerator =
      statistic.kind === "MEAN_AGE" ? alt.numerator : numerator;
    const altValue = roundRatio(
      altNumerator,
      alt.denominator,
      precision,
      rulebook.roundingMode
    );
    if (altValue === displayed) {
      return finding(
        ctx,
        "DENOMINATOR",
        expected,
        `${displayed} divides by ${alt.denominator}, the ${POPULATION_LABELS[population]} N for ${columnLabel}. The SAP population is ${POPULATION_LABELS[rulebook.populationSuit]} (N=${denominator}): ${exact} gives ${expected}.`
      );
    }
  }

  return finding(
    ctx,
    "VALUE",
    expected,
    `${displayed} cannot be reproduced from the snapshot: ${exact} gives ${expected}.`
  );
}

/** Checks a displayed decimal statistic against the SAP. */
function checkStatistic(
  ctx: CellContext,
  statistic: RowStatistic,
  displayed: string,
  precision: number,
  numeratorLabel: string
): QcFinding[] {
  const { rulebook, snapshot, arm } = ctx;
  const suitSubjects = members(snapshot.subjects, rulebook.populationSuit, arm);
  const { numerator, denominator } = ratioFor(statistic, suitSubjects);
  const expected = roundRatio(
    numerator,
    denominator,
    precision,
    rulebook.roundingMode
  ) as string;
  const shown = decimalPlaces(displayed);

  if (shown === precision) {
    return displayed === expected
      ? []
      : [
          classifyStatistic(
            ctx,
            statistic,
            displayed,
            precision,
            expected,
            numeratorLabel
          ),
        ];
  }

  const findings: QcFinding[] = [
    finding(
      ctx,
      "PRECISION",
      expected,
      `${displayed} shows ${shown} decimal place${shown === 1 ? "" : "s"}; the SAP specifies ${precision}.`
    ),
  ];
  const atShownPrecision = roundRatio(
    numerator,
    denominator,
    shown,
    rulebook.roundingMode
  );
  if (displayed !== atShownPrecision) {
    const wrong = classifyStatistic(
      ctx,
      statistic,
      displayed,
      shown,
      expected,
      numeratorLabel
    );
    findings.push(wrong);
  }
  return findings;
}

function checkPopulationN(ctx: CellContext): QcFinding[] {
  const { rulebook, snapshot, arm, observed, columnLabel } = ctx;
  const expectedN = ratioFor(
    { kind: "POPULATION_N" },
    members(snapshot.subjects, rulebook.populationSuit, arm)
  ).numerator;
  const expected = String(expectedN);
  if (observed === expected) return [];
  if (!INTEGER_PATTERN.test(observed)) {
    return [
      finding(ctx, "VALUE", expected, `"${observed}" is not a subject count.`),
    ];
  }
  for (const population of alternativePopulations(rulebook)) {
    const altN = members(snapshot.subjects, population, arm).length;
    if (altN !== expectedN && String(altN) === observed) {
      return [
        finding(
          ctx,
          "DENOMINATOR",
          expected,
          `N=${observed} is the ${POPULATION_LABELS[population]} count for ${columnLabel}; the SAP population is ${POPULATION_LABELS[rulebook.populationSuit]} (N=${expected}).`
        ),
      ];
    }
  }
  return [
    finding(
      ctx,
      "VALUE",
      expected,
      `N=${observed} does not match the snapshot's ${POPULATION_LABELS[rulebook.populationSuit]} count (${expected}).`
    ),
  ];
}

function checkCell(ctx: CellContext, statistic: RowStatistic): QcFinding[] {
  const { rulebook, snapshot, arm, observed } = ctx;
  if (statistic.kind === "POPULATION_N") return checkPopulationN(ctx);

  const suitSubjects = members(snapshot.subjects, rulebook.populationSuit, arm);
  if (suitSubjects.length === 0) {
    return observed === NOT_ESTIMABLE
      ? []
      : [
          finding(
            ctx,
            "VALUE",
            NOT_ESTIMABLE,
            `The column has no ${POPULATION_LABELS[rulebook.populationSuit]} subjects, so the statistic is not estimable.`
          ),
        ];
  }

  if (statistic.kind === "MEAN_AGE") {
    if (!DECIMAL_PATTERN.test(observed)) {
      const expected = roundRatio(
        ratioFor(statistic, suitSubjects).numerator,
        suitSubjects.length,
        rulebook.meanPrecision,
        rulebook.roundingMode
      ) as string;
      return [
        finding(ctx, "VALUE", expected, `"${observed}" is not a number.`),
      ];
    }
    const sum = ratioFor(statistic, suitSubjects).numerator;
    return checkStatistic(
      ctx,
      statistic,
      observed,
      rulebook.meanPrecision,
      String(sum)
    );
  }

  const { numerator } = ratioFor(statistic, suitSubjects);
  const count = numerator / 100;
  const expectedPct = roundRatio(
    numerator,
    suitSubjects.length,
    rulebook.percentPrecision,
    rulebook.roundingMode
  ) as string;
  const expectedCell = `${count} (${expectedPct})`;
  const match = COUNT_PCT_PATTERN.exec(observed);
  if (!match) {
    return [
      finding(
        ctx,
        "VALUE",
        expectedCell,
        `"${observed}" is not in "n (%)" form.`
      ),
    ];
  }
  if (Number(match[1]) !== count) {
    const events =
      statistic.kind === "AE_SUBJECT_COUNT_PCT"
        ? suitSubjects.reduce(
            (sum, s) => sum + matchingEvents(statistic, s).length,
            0
          )
        : count;
    return [
      finding(
        ctx,
        "VALUE",
        expectedCell,
        Number(match[1]) === events
          ? `n=${match[1]} counts events, not subjects. ${events} events belong to ${count} subject${count === 1 ? "" : "s"}, and a subject is counted once however many events they have.`
          : `n=${match[1]} does not match the snapshot, which has ${count} qualifying subjects.`
      ),
    ];
  }
  return checkStatistic(
    ctx,
    statistic,
    match[2],
    rulebook.percentPrecision,
    `${count} × 100`
  ).map((f) => ({ ...f, observed, expected: `${count} (${f.expected})` }));
}

function compareFindings(a: QcFinding, b: QcFinding): number {
  return (
    a.cell.row - b.cell.row ||
    a.cell.col - b.cell.col ||
    CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
  );
}

/**
 * Validates a staged table against a population snapshot and SAP rulebook.
 *
 * Pure and deterministic: it never mutates its inputs, never reads browser
 * state or randomness, and returns findings in a stable order (row, column,
 * category). Denominators are always derived from the snapshot.
 */
export function validate(
  table: StagedTable,
  snapshot: PopulationSnapshot,
  rulebook: SapRulebook
): QcReport {
  const findings: QcFinding[] = [];
  table.rows.forEach((row, rowIndex) => {
    table.columns.forEach((column, colIndex) => {
      const observed = (table.cells[rowIndex]?.[colIndex] ?? "").trim();
      findings.push(
        ...checkCell(
          {
            snapshot,
            rulebook,
            cell: { row: rowIndex, col: colIndex },
            arm: column.arm,
            columnLabel: column.label,
            observed,
          },
          row.statistic
        )
      );
    });
  });

  return {
    tableId: table.id,
    rulebookId: rulebook.id,
    populationSnapshotId: snapshot.id,
    populationN: members(snapshot.subjects, rulebook.populationSuit, "TOTAL")
      .length,
    findings: findings.sort(compareFindings),
  };
}
