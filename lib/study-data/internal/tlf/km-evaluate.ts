/**
 * Evaluates the time-to-event analyses of a reporting plan: the
 * Kaplan-Meier estimate by treatment group and the log-rank test across
 * groups. Like the rest of the engine, every result names the ADaM rows it
 * was computed from:
 *
 * - n at risk at t: the ADTTE records whose AVAL is t or later;
 * - n events and n censored at t: the records with that outcome at t;
 * - the estimate, its standard error and limits: every analysable record
 *   of the group, which is what the product-limit estimate at t is
 *   computed from (each record is either still at risk or has left the
 *   risk set by then);
 * - the log-rank results: every analysable record of every group.
 *
 * Each result also names the ADSL rows of its population.
 */
import type {
  ArsGroupingFactor,
  ArsOperationResult,
  ArsResultGroup,
  ArsRowReference,
  CellValue,
  Dataset,
  KaplanMeierStep,
  SurvivalObservation,
} from "../../types";
import { kaplanMeierEstimate, logRankTest } from "./km";
import { IDS, KM_DECIMALS, KM_OPERATIONS, type AnalysisSpec } from "./plan";
import type { RowSetRegistry } from "./row-sets";
import { formatDecimal } from "./stats";
import { matchesWhereClause, recordValue, type RecordContext } from "./where";

/** Variable whose value 0 marks an event and 1 a censored time. */
const CENSOR_VARIABLE = "CNSR";

const NOT_ESTIMABLE = "NE";

/** Whether the time-to-event evaluator, not the table engine, runs a method. */
export function isTimeToEventMethod(methodId: string): boolean {
  return methodId === IDS.km || methodId === IDS.logRank;
}

/**
 * A p-value to four decimals, or `<0.0001` when it would print as zero.
 *
 * @throws RangeError when the value is not a probability.
 */
export function formatPValue(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`A p-value must be from 0 to 1, got ${value}.`);
  }
  return value < 0.00005 ? "<0.0001" : formatDecimal(value, 4);
}

/** What the time-to-event evaluator needs from the engine for one analysis. */
export interface TimeToEventInput {
  readonly spec: AnalysisSpec;
  /** Every grouping of the analysis, in order, whether or not it has results by group. */
  readonly factors: readonly ArsGroupingFactor[];
  /** ADSL records of the analysis set. */
  readonly population: readonly RecordContext[];
  /** Analysis records of the analysis set and data subset. */
  readonly records: readonly RecordContext[];
  readonly adsl: Dataset;
  readonly data: Dataset;
  readonly registry: RowSetRegistry;
}

interface Analysable {
  readonly record: RecordContext;
  readonly observation: SurvivalObservation;
}

function observationOf(
  record: RecordContext,
  dataset: string,
  variable: string
): SurvivalObservation | null {
  const time: CellValue = recordValue(record, dataset, variable);
  const censor: CellValue = recordValue(record, dataset, CENSOR_VARIABLE);
  if (typeof time !== "number" || !Number.isFinite(time) || time < 0) {
    return null;
  }
  if (censor !== 0 && censor !== 1) return null;
  return { time, event: censor === 0 };
}

interface ArmData {
  readonly groups: readonly ArsResultGroup[];
  readonly population: readonly RecordContext[];
  readonly analysable: readonly Analysable[];
}

function arms(input: TimeToEventInput): {
  readonly factor: ArsGroupingFactor;
  readonly arms: readonly ArmData[];
} {
  const [factor] = input.factors;
  if (!factor || factor.dataDriven) {
    throw new RangeError(
      `${input.spec.id} needs a pre-specified treatment grouping first.`
    );
  }
  const analysable: Analysable[] = input.records.flatMap((record) => {
    const observation = observationOf(
      record,
      input.spec.dataset,
      input.spec.variable
    );
    return observation ? [{ record, observation }] : [];
  });
  return {
    factor,
    arms: factor.groups.map((group) => ({
      groups: [{ groupingId: factor.id, groupId: group.id }],
      population: input.population.filter((record) =>
        matchesWhereClause(record, group)
      ),
      analysable: analysable.filter((item) =>
        matchesWhereClause(item.record, group)
      ),
    })),
  };
}

function references(
  input: TimeToEventInput,
  population: readonly RecordContext[],
  analysed: readonly Analysable[]
): readonly ArsRowReference[] {
  return [
    input.registry.reference(
      input.adsl,
      population.map((record) => record.rowIndex),
      "population"
    ),
    input.registry.reference(
      input.data,
      analysed.map((item) => item.record.rowIndex),
      "analysis"
    ),
  ].filter((reference) => reference !== null);
}

function estimateText(value: number | null): {
  readonly rawValue?: string;
  readonly formattedValue: string;
} {
  return value === null
    ? { formattedValue: NOT_ESTIMABLE }
    : {
        rawValue: String(value),
        formattedValue: formatDecimal(value, KM_DECIMALS),
      };
}

function countText(value: number): {
  readonly rawValue: string;
  readonly formattedValue: string;
} {
  return { rawValue: String(value), formattedValue: String(value) };
}

/** The origin of a curve: everyone at risk, no events, survival 1. */
function originStep(n: number): KaplanMeierStep {
  return {
    time: 0,
    atRisk: n,
    events: 0,
    censored: 0,
    survival: 1,
    standardError: 0,
    lower: null,
    upper: null,
  };
}

function kaplanMeierResults(input: TimeToEventInput): ArsOperationResult[] {
  const timeFactor = input.factors[1];
  if (!timeFactor?.dataDriven) {
    throw new RangeError(
      `${input.spec.id} needs a data-driven time grouping second.`
    );
  }
  const results: ArsOperationResult[] = [];
  for (const arm of arms(input).arms) {
    if (arm.analysable.length === 0) continue;
    const estimate = kaplanMeierEstimate(
      arm.analysable.map((item) => item.observation)
    );
    const everything = references(input, arm.population, arm.analysable);
    for (const step of [originStep(estimate.n), ...estimate.steps]) {
      const atTime = (event: boolean) =>
        arm.analysable.filter(
          (item) =>
            item.observation.time === step.time &&
            item.observation.event === event
        );
      const rowsFor = {
        atRisk: references(
          input,
          arm.population,
          arm.analysable.filter((item) => item.observation.time >= step.time)
        ),
        events: references(input, arm.population, atTime(true)),
        censored: references(input, arm.population, atTime(false)),
      };
      const resultGroups: readonly ArsResultGroup[] = [
        ...arm.groups,
        { groupingId: timeFactor.id, groupValue: String(step.time) },
      ];
      for (const operation of KM_OPERATIONS) {
        const kind = operation.kind;
        const value =
          kind === "atRisk" || kind === "events" || kind === "censored"
            ? countText(step[kind])
            : estimateText(step[kind]);
        results.push({
          id: `${input.spec.id}.${String(results.length + 1).padStart(3, "0")}`,
          operationId: operation.id,
          resultGroups,
          ...value,
          rowReferences:
            kind === "atRisk" || kind === "events" || kind === "censored"
              ? rowsFor[kind]
              : everything,
        });
      }
    }
  }
  return results;
}

function logRankResults(input: TimeToEventInput): ArsOperationResult[] {
  const groups = arms(input).arms;
  const test = logRankTest(
    groups.map((arm) => arm.analysable.map((item) => item.observation))
  );
  const rowReferences = references(
    input,
    groups.flatMap((arm) => arm.population),
    groups.flatMap((arm) => arm.analysable)
  );
  const values: readonly {
    readonly operationId: string;
    readonly rawValue?: string;
    readonly formattedValue: string;
  }[] = [
    {
      operationId: IDS.logRankChiSq,
      ...(test.chiSquare === null
        ? { formattedValue: NOT_ESTIMABLE }
        : {
            rawValue: String(test.chiSquare),
            formattedValue: formatDecimal(test.chiSquare, 2),
          }),
    },
    { operationId: IDS.logRankDf, ...countText(test.degreesOfFreedom) },
    {
      operationId: IDS.logRankP,
      ...(test.pValue === null
        ? { formattedValue: NOT_ESTIMABLE }
        : {
            rawValue: String(test.pValue),
            formattedValue: formatPValue(test.pValue),
          }),
    },
  ];
  return values.map((value, index) => ({
    id: `${input.spec.id}.${String(index + 1).padStart(3, "0")}`,
    ...value,
    resultGroups: [],
    rowReferences,
  }));
}

/**
 * The results of one time-to-event analysis.
 *
 * @throws RangeError when the method is not a time-to-event method or the
 *   analysis does not group by a pre-specified treatment factor (and, for
 *   the estimate, a data-driven time factor after it).
 */
export function evaluateTimeToEvent(
  input: TimeToEventInput
): ArsOperationResult[] {
  if (input.spec.methodId === IDS.km) return kaplanMeierResults(input);
  if (input.spec.methodId === IDS.logRank) return logRankResults(input);
  throw new RangeError(`${input.spec.methodId} is not a time-to-event method.`);
}
